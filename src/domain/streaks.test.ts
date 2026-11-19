import { describe, expect, it } from 'vitest';
import { computeStreak } from './streaks';

const days = (...keys: string[]) => new Set(keys);

describe('computeStreak', () => {
  it('is zero with no activity', () => {
    expect(computeStreak(days(), '2026-03-10')).toEqual({
      current: 0,
      longest: 0,
      loggedToday: false,
    });
  });

  it('counts consecutive days ending today', () => {
    const streak = computeStreak(days('2026-03-08', '2026-03-09', '2026-03-10'), '2026-03-10');
    expect(streak).toEqual({ current: 3, longest: 3, loggedToday: true });
  });

  it('keeps the streak alive until the end of today', () => {
    const streak = computeStreak(days('2026-03-08', '2026-03-09'), '2026-03-10');
    expect(streak.current).toBe(2);
    expect(streak.loggedToday).toBe(false);
  });

  it('resets after a missed day but remembers the longest run', () => {
    const streak = computeStreak(
      days('2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-10'),
      '2026-03-10',
    );
    expect(streak.current).toBe(1);
    expect(streak.longest).toBe(4);
  });

  it('counts across month and year boundaries', () => {
    const streak = computeStreak(days('2025-12-30', '2025-12-31', '2026-01-01'), '2026-01-01');
    expect(streak.current).toBe(3);
  });
});

describe('computeStreak with planned days off', () => {
  // 2026-11-15 is a Sunday. Plan: Sunday and Tuesday only.
  const offExceptSunTue = (day: string) =>
    !['2026-11-15', '2026-11-17', '2026-11-22', '2026-11-24'].includes(day);

  it('carries a streak over the days off', () => {
    const streak = computeStreak(
      days('2026-11-15', '2026-11-17', '2026-11-22'),
      '2026-11-23',
      offExceptSunTue,
    );
    expect(streak.current).toBe(3);
    expect(streak.longest).toBe(3);
  });

  it('still breaks on a planned day that was missed', () => {
    const streak = computeStreak(days('2026-11-15', '2026-11-22'), '2026-11-23', offExceptSunTue);
    expect(streak.current).toBe(1);
  });

  it('counts time put in on a day off as a bonus day', () => {
    const streak = computeStreak(
      days('2026-11-15', '2026-11-16', '2026-11-17'),
      '2026-11-17',
      offExceptSunTue,
    );
    expect(streak.current).toBe(3);
  });

  it('waits for today if today is planned and not done yet', () => {
    const streak = computeStreak(days('2026-11-15', '2026-11-17'), '2026-11-22', offExceptSunTue);
    expect(streak).toMatchObject({ current: 2, loggedToday: false });
  });
});
