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
