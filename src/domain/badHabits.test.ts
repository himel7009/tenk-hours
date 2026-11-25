import { describe, expect, it } from 'vitest';
import {
  checkInId,
  summarizeBadHabit,
  buildBadHabitReport,
  type CheckIn,
  type CheckInStatus,
} from './badHabits';

const today = '2026-11-18';
const answer = (day: string, status: CheckInStatus): CheckIn => ({
  id: checkInId('h', day),
  habitId: 'h',
  day,
  status,
  createdAt: 0,
});

describe('checkInId', () => {
  it('is the same for the same habit and day, and a valid UUID shape', () => {
    expect(checkInId('h', today)).toBe(checkInId('h', today));
    expect(checkInId('h', today)).not.toBe(checkInId('h', '2026-11-17'));
    expect(checkInId('h', today)).not.toBe(checkInId('g', today));
    expect(checkInId('h', today)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe('summarizeBadHabit', () => {
  it('counts clean days in a row, keeping a streak alive until today is answered', () => {
    const days = ['2026-11-15', '2026-11-16', '2026-11-17'].map((d) => answer(d, 'clean'));
    expect(summarizeBadHabit(days, today)).toMatchObject({ currentStreak: 3, todayStatus: null });
    expect(summarizeBadHabit([...days, answer(today, 'clean')], today).currentStreak).toBe(4);
  });

  it('ends the streak on a slip, but remembers the longest run', () => {
    const progress = summarizeBadHabit(
      [
        answer('2026-11-10', 'clean'),
        answer('2026-11-11', 'clean'),
        answer('2026-11-12', 'clean'),
        answer('2026-11-13', 'slipped'),
        answer('2026-11-17', 'clean'),
        answer(today, 'slipped'),
      ],
      today,
    );
    expect(progress).toMatchObject({
      currentStreak: 0,
      longestStreak: 3,
      cleanDays: 4,
      slippedDays: 2,
      lastSlip: today,
    });
  });

  it('treats a day with no answer as a break', () => {
    const progress = summarizeBadHabit(
      [answer('2026-11-15', 'clean'), answer('2026-11-17', 'clean')],
      today,
    );
    expect(progress.currentStreak).toBe(1);
  });

  it('works out the clean rate over the last 30 days', () => {
    const progress = summarizeBadHabit(
      [
        answer('2026-09-01', 'slipped'), // too old to count
        answer('2026-11-16', 'clean'),
        answer('2026-11-17', 'clean'),
        answer('2026-11-18', 'clean'),
        answer('2026-11-14', 'slipped'),
      ],
      today,
    );
    expect(progress.cleanRate30).toBe(0.75);
    expect(summarizeBadHabit([], today).cleanRate30).toBeNull();
  });
});

describe('buildBadHabitReport', () => {
  const habit = { createdAt: new Date('2026-10-01T09:00:00').getTime() };
  const answer = (day: string, status: 'clean' | 'slipped') => ({
    id: day,
    habitId: 'h',
    day,
    status,
    createdAt: 0,
  });
  // Slips on three Fridays in November, clean otherwise on answered days.
  const checkIns = [
    answer('2026-11-06', 'slipped'),
    answer('2026-11-13', 'slipped'),
    answer('2026-11-20', 'slipped'),
    answer('2026-11-21', 'clean'),
    answer('2026-11-22', 'clean'),
    answer('2026-11-23', 'clean'),
    answer('2026-11-24', 'clean'),
    answer('2026-10-15', 'clean'),
  ];
  const report = buildBadHabitReport(habit, checkIns, '2026-11-25');

  it('says where it stands', () => {
    expect(report).toMatchObject({
      since: '2026-10-01',
      currentStreak: 4,
      daysSinceLastSlip: 5,
      averageGap: 7,
      slipsLast30: 3,
      slipsPrevious30: 0,
    });
    // 1 Oct to 24 Nov is 55 days, 8 of them answered; today does not count yet.
    expect(report.unansweredDays).toBe(47);
  });

  it('finds the weekday it slips most on', () => {
    expect(report.riskiestWeekday).toMatchObject({ weekday: 5, slips: 3, slipRate: 1 });
    expect(report.byWeekday[0]).toMatchObject({ answered: 1, slips: 0, slipRate: 0 });
  });

  it('breaks the months down, starting when tracking began', () => {
    expect(report.months).toEqual([
      { month: '2026-10', clean: 1, slipped: 0, unanswered: 30 },
      { month: '2026-11', clean: 4, slipped: 3, unanswered: 17 },
    ]);
  });

  it('labels each day of the calendar', () => {
    expect(report.statusOn('2026-11-20')).toBe('slipped');
    expect(report.statusOn('2026-11-21')).toBe('clean');
    expect(report.statusOn('2026-11-10')).toBe('unanswered');
    expect(report.statusOn('2026-09-30')).toBe('before');
    expect(report.statusOn('2026-11-26')).toBe('future');
  });

  it('needs two slips on a weekday to call it the riskiest', () => {
    const one = buildBadHabitReport(habit, [answer('2026-11-20', 'slipped')], '2026-11-25');
    expect(one.riskiestWeekday).toBeNull();
    expect(one.averageGap).toBeNull();
  });
});
