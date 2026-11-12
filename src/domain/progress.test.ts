import { describe, expect, it } from 'vitest';
import { summarizeProgress } from './progress';
import type { Session } from './types';

const session = (day: string, minutes: number): Session => ({
  id: `${day}-${minutes}`,
  skillId: 'skill',
  day,
  minutes,
  note: '',
  source: 'manual',
  createdAt: 0,
});

describe('summarizeProgress', () => {
  const today = '2026-11-12';

  it('only counts days that reach the daily goal towards the streak', () => {
    const progress = summarizeProgress(
      [session('2026-11-10', 60), session('2026-11-11', 59), session(today, 90)],
      10_000,
      60,
      today,
    );
    expect(progress.completedDays).toEqual(new Set(['2026-11-10', today]));
    expect(progress.streak).toMatchObject({ current: 1, longest: 1 });
    // Time below the goal is still logged, it just doesn't extend the streak.
    expect(progress.loggedMinutes).toBe(209);
  });

  it('adds up several sessions in a day before comparing with the goal', () => {
    const progress = summarizeProgress(
      [session(today, 25), session(today, 25), session(today, 10)],
      10_000,
      60,
      today,
    );
    expect(progress.goalMetToday).toBe(true);
    expect(progress.streak.current).toBe(1);
  });

  it('respects a goal other than an hour', () => {
    const sessions = [session('2026-11-11', 10), session(today, 10)];
    expect(summarizeProgress(sessions, 10_000, 10, today).streak.current).toBe(2);
    expect(summarizeProgress(sessions, 10_000, 15, today).streak.current).toBe(0);
  });
});
