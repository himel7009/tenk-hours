import { describe, expect, it } from 'vitest';
import { activityYears, buildActivityCalendar, combineByDay, levelScale } from './activity';

const today = '2026-11-19'; // Thursday

describe('buildActivityCalendar', () => {
  it('shows 53 weeks ending today, Sunday at the top of each column', () => {
    const calendar = buildActivityCalendar(new Map(), { kind: 'year-to-date' }, today);
    expect(calendar.weeks).toHaveLength(53);
    expect(calendar.start).toBe('2025-11-16'); // a Sunday
    const last = calendar.weeks.at(-1)!;
    expect(last[4]?.day).toBe(today);
    expect(last[5]).toBeNull();
    expect(calendar.weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('lays out a calendar year with blanks before the 1st', () => {
    const calendar = buildActivityCalendar(new Map(), { kind: 'year', year: 2026 }, today);
    // 1 January 2026 was a Thursday.
    expect(calendar.weeks[0]?.slice(0, 4)).toEqual([null, null, null, null]);
    expect(calendar.weeks[0]?.[4]?.day).toBe('2026-01-01');
    expect(calendar.months.map((m) => m.label)).toHaveLength(12);
    // Days after today are marked and hold nothing.
    expect(calendar.weeks.at(-1)?.find((cell) => cell)?.future).toBe(true);
  });

  it('adds up totals and runs of active days', () => {
    const byDay = new Map([
      ['2026-11-12', 30],
      ['2026-11-13', 60],
      ['2026-11-14', 45],
      ['2026-11-18', 20],
      ['2026-11-19', 10],
    ]);
    const calendar = buildActivityCalendar(byDay, { kind: 'year-to-date' }, today);
    expect(calendar).toMatchObject({
      totalMinutes: 165,
      activeDays: 5,
      longestRun: 3,
      currentRun: 2,
    });
  });
});

describe('levelScale', () => {
  it('follows the daily goal when there is one', () => {
    const level = levelScale([], 60);
    expect([0, 10, 30, 60, 120].map(level)).toEqual([0, 1, 2, 3, 4]);
  });

  it('splits the busy days into quarters without one', () => {
    const level = levelScale([0, 10, 20, 30, 40], null);
    expect([0, 10, 20, 30, 40].map(level)).toEqual([0, 1, 2, 3, 4]);
  });
});

it('lists years with time, newest first', () => {
  expect(activityYears(new Map([['2024-03-01', 5]]), today)).toEqual([2026, 2024]);
});

it('combines trackers day by day', () => {
  const total = combineByDay([
    new Map([['a', 10]]),
    new Map([
      ['a', 5],
      ['b', 1],
    ]),
  ]);
  expect([...total]).toEqual([
    ['a', 15],
    ['b', 1],
  ]);
});
