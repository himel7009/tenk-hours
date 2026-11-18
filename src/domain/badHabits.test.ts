import { describe, expect, it } from 'vitest';
import { checkInId, summarizeBadHabit, type CheckIn, type CheckInStatus } from './badHabits';

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
