import { describe, expect, it } from 'vitest';
import { dailyPace, minutesByDay, projectFinish, totalMinutes } from './stats';
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

describe('totals', () => {
  it('sums minutes and groups them by day', () => {
    const sessions = [
      session('2026-03-01', 30),
      session('2026-03-01', 45),
      session('2026-03-02', 60),
    ];
    expect(totalMinutes(sessions)).toBe(135);
    expect(minutesByDay(sessions)).toEqual(
      new Map([
        ['2026-03-01', 75],
        ['2026-03-02', 60],
      ]),
    );
  });
});

describe('dailyPace', () => {
  it('is zero without sessions', () => {
    expect(dailyPace(new Map(), '2026-03-10')).toBe(0);
  });

  it('averages over the days since the first session for a new skill', () => {
    const byDay = new Map([
      ['2026-03-07', 120],
      ['2026-03-10', 120],
    ]);
    expect(dailyPace(byDay, '2026-03-10')).toBe(60);
  });

  it('ignores time logged before the 30 day window', () => {
    const byDay = new Map([
      ['2025-01-01', 6000],
      ['2026-03-10', 300],
    ]);
    expect(dailyPace(byDay, '2026-03-10')).toBe(10);
  });
});

describe('projectFinish', () => {
  it('returns null when there is no pace', () => {
    expect(projectFinish(0, 100, 0, '2026-03-10')).toBeNull();
  });

  it('returns today once the target is reached', () => {
    expect(projectFinish(6000, 100, 0, '2026-03-10')).toBe('2026-03-10');
  });

  it('projects from the remaining time', () => {
    // 10 hours left at 2 hours a day.
    expect(projectFinish(5400, 100, 120, '2026-03-10')).toBe('2026-03-15');
  });
});
