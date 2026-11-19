import { describe, expect, it } from 'vitest';
import type { BadHabit, CheckIn } from './badHabits';
import type { Domain } from './domains';
import { buildReport, buildTrend, periodContaining, periodDays, shiftPeriod } from './report';
import type { Session, Skill } from './types';

const created = new Date(2026, 0, 1, 9).getTime();
const skill = (id: string, extra: Partial<Skill> = {}): Skill => ({
  id,
  kind: 'skill',
  name: id,
  icon: '⭐',
  color: 'cobalt',
  targetHours: 10_000,
  dailyGoalMinutes: 60,
  domainId: null,
  createdAt: created,
  ...extra,
});
let n = 0;
const session = (skillId: string, day: string, minutes: number): Session => ({
  id: `s${(n += 1)}`,
  skillId,
  day,
  minutes,
  note: '',
  source: 'manual',
  createdAt: created,
});
const empty = { domains: [] as Domain[], badHabits: [] as BadHabit[], checkIns: [] as CheckIn[] };

describe('periods', () => {
  it('weeks run Monday to Sunday', () => {
    // 2026-11-19 is a Thursday.
    expect(periodContaining('week', '2026-11-19')).toMatchObject({
      start: '2026-11-16',
      end: '2026-11-22',
    });
    expect(periodContaining('week', '2026-11-22')).toMatchObject({ start: '2026-11-16' });
    expect(periodContaining('week', '2026-11-23')).toMatchObject({ start: '2026-11-23' });
  });

  it('months follow the calendar, across years', () => {
    const feb = periodContaining('month', '2028-02-10');
    expect(feb).toMatchObject({ start: '2028-02-01', end: '2028-02-29' });
    expect(periodDays(feb)).toHaveLength(29);
    expect(shiftPeriod(periodContaining('month', '2026-01-15'), -1)).toMatchObject({
      start: '2025-12-01',
      end: '2025-12-31',
    });
    expect(shiftPeriod(periodContaining('week', '2026-12-30'), 1).start).toBe('2027-01-04');
  });
});

describe('buildReport', () => {
  const today = '2026-11-19'; // Thursday
  const week = periodContaining('week', today);

  it('adds up the week and compares it with the same days of last week', () => {
    const sessions = [
      session('a', '2026-11-16', 90),
      session('a', '2026-11-18', 30),
      session('b', '2026-11-18', 45),
      // Last week: Mon to Thu count, Friday does not.
      session('a', '2026-11-10', 60),
      session('a', '2026-11-14', 300),
    ];
    const report = buildReport(
      { skills: [skill('a'), skill('b')], sessions, ...empty },
      week,
      today,
    );
    expect(report.totalMinutes).toBe(165);
    expect(report.previousMinutes).toBe(60);
    expect(report.elapsedDays).toBe(4);
    expect(report.activeDays).toBe(2);
    expect(report.bestDay).toEqual({ day: '2026-11-16', minutes: 90 });
    expect(report.days.filter((day) => day.future)).toHaveLength(3);
    expect(report.longestSession).toMatchObject({ minutes: 90, day: '2026-11-16' });
  });

  it('compares a finished week with the whole week before', () => {
    const sessions = [session('a', '2026-11-14', 300), session('a', '2026-11-09', 30)];
    const last = shiftPeriod(week, -1);
    const report = buildReport({ skills: [skill('a')], sessions, ...empty }, last, today);
    expect(report.inProgress).toBe(false);
    expect(report.elapsedDays).toBe(7);
    expect(report.totalMinutes).toBe(330);
  });

  it('counts daily goals only from the day a skill was created', () => {
    const newer = skill('n', { createdAt: new Date(2026, 10, 18, 8).getTime() });
    const sessions = [session('a', '2026-11-16', 60), session('n', '2026-11-18', 75)];
    const report = buildReport({ skills: [skill('a'), newer], sessions, ...empty }, week, today);
    const goal = (id: string) => report.trackers.find((t) => t.skill.id === id)?.goal;
    expect(goal('a')).toEqual({ met: 1, possible: 4 });
    expect(goal('n')).toEqual({ met: 1, possible: 2 });
    expect(report.goals).toEqual({ met: 2, possible: 6 });
  });

  it('gives projects time but no goal, and groups time by domain', () => {
    const domain: Domain = { id: 'd', name: 'AI', icon: '🤖', color: 'plum', createdAt: created };
    const project = skill('p', { kind: 'project', domainId: 'd' });
    const ml = skill('ml', { domainId: 'd' });
    const sessions = [session('p', '2026-11-17', 120), session('ml', '2026-11-17', 30)];
    const report = buildReport(
      { skills: [project, ml], sessions, domains: [domain], badHabits: [], checkIns: [] },
      week,
      today,
    );
    expect(report.trackers.find((t) => t.skill.id === 'p')?.goal).toBeNull();
    expect(report.domains).toEqual([{ domain, minutes: 150, previousMinutes: 0 }]);
  });

  it('counts clean, slipped and unanswered days for bad habits', () => {
    const habit: BadHabit = {
      id: 'h',
      name: 'Scrolling',
      icon: '📱',
      color: 'rose',
      createdAt: created,
    };
    const checkIn = (day: string, status: 'clean' | 'slipped'): CheckIn => ({
      id: day,
      habitId: 'h',
      day,
      status,
      createdAt: created,
    });
    const report = buildReport(
      {
        skills: [],
        sessions: [],
        domains: [],
        badHabits: [habit],
        checkIns: [
          checkIn('2026-11-16', 'clean'),
          checkIn('2026-11-17', 'slipped'),
          checkIn('2026-11-19', 'clean'),
        ],
      },
      week,
      today,
    );
    expect(report.badHabits).toEqual([{ habit, clean: 2, slipped: 1, unanswered: 1 }]);
  });
});

describe('buildTrend', () => {
  it('totals each of the last periods, oldest first', () => {
    const sessions = [session('a', '2026-11-03', 60), session('a', '2026-11-18', 30)];
    const trend = buildTrend(sessions, periodContaining('week', '2026-11-19'), 3);
    expect(trend.map((point) => [point.period.start, point.minutes])).toEqual([
      ['2026-11-02', 60],
      ['2026-11-09', 0],
      ['2026-11-16', 30],
    ]);
  });
});
