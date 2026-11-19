import { describe, expect, it } from 'vitest';
import { summarizeDashboard } from './dashboard';
import type { Session, Skill } from './types';

const skill = (id: string): Skill => ({
  id,
  kind: 'skill',
  name: id,
  icon: '🎯',
  color: 'cobalt',
  targetHours: 10_000,
  dailyGoalMinutes: 60,
  keepStreak: true,
  routineDays: [],
  domainId: null,
  createdAt: 0,
});

const session = (skillId: string, day: string, minutes: number): Session => ({
  id: `${skillId}-${day}-${minutes}`,
  skillId,
  day,
  minutes,
  note: '',
  source: 'manual',
  createdAt: 0,
});

describe('summarizeDashboard', () => {
  const today = '2026-11-16';
  const dashboard = summarizeDashboard(
    [skill('ml'), skill('swimming')],
    [
      session('ml', today, 90),
      session('swimming', today, 30),
      session('ml', '2026-11-15', 60),
      session('ml', '2026-11-10', 45), // first day of the 7-day window
      session('ml', '2026-11-09', 200), // the week before
      session('ml', '2026-01-01', 1000),
    ],
    today,
  );

  it('totals today, the last seven days and the seven before', () => {
    expect(dashboard.minutesToday).toBe(120);
    expect(dashboard.weekMinutes).toBe(225);
    expect(dashboard.previousWeekMinutes).toBe(200);
    expect(dashboard.totalMinutes).toBe(1425);
  });

  it('builds one bar per day, oldest first, split by skill', () => {
    expect(dashboard.week.map((bar) => bar.day)).toEqual([
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      today,
    ]);
    expect(dashboard.week[6]?.segments.map((s) => [s.skill.id, s.minutes])).toEqual([
      ['ml', 90],
      ['swimming', 30],
    ]);
  });

  it('never reports a project as the best streak', () => {
    const project = { ...skill('app'), kind: 'project' as const, keepStreak: false };
    const days = ['2026-11-14', '2026-11-15', today].map((day) => session('app', day, 120));
    expect(summarizeDashboard([project], days, today).bestStreak).toBeNull();
  });

  it('reports the longest streak currently running', () => {
    expect(dashboard.bestStreak).toMatchObject({ days: 2, skill: { id: 'ml' } });
    expect(summarizeDashboard([skill('ml')], [], today).bestStreak).toBeNull();
  });
});
