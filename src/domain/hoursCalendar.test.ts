import { describe, expect, it } from 'vitest';
import {
  buildHoursMonth,
  firstMonth,
  hoursLevel,
  levelEmoji,
  levelRange,
  shiftMonth,
} from './hoursCalendar';

describe('hoursLevel', () => {
  it('steps up every two hours and tops out at ten', () => {
    expect(hoursLevel(0)).toBe(0);
    expect(hoursLevel(30)).toBe(1);
    expect(hoursLevel(119)).toBe(1);
    expect(hoursLevel(120)).toBe(2);
    expect(hoursLevel(5 * 60)).toBe(3);
    expect(hoursLevel(6 * 60)).toBe(4);
    expect(hoursLevel(9 * 60 + 59)).toBe(5);
    expect(hoursLevel(10 * 60)).toBe(6);
    expect(hoursLevel(16 * 60)).toBe(6);
  });

  it('names each step and its emoji', () => {
    expect(levelRange(1)).toBe('Under 2h');
    expect(levelRange(4)).toBe('6–8h');
    expect(levelRange(6)).toBe('10h+');
    expect(levelEmoji(6)).toBe('👑');
    expect(levelEmoji(0)).toBe('');
  });
});

describe('buildHoursMonth', () => {
  const byDay = new Map([
    ['2026-11-01', 90],
    ['2026-11-10', 600],
    ['2026-11-24', 300],
    ['2026-10-31', 999],
  ]);
  const month = buildHoursMonth(byDay, '2026-11', '2026-11-24');

  it('lays the month out in Sunday-first weeks', () => {
    // 1 November 2026 is a Sunday; 30 days fill five weeks.
    expect(month.weeks).toHaveLength(5);
    expect(month.weeks[0]?.[0]?.day).toBe('2026-11-01');
    expect(month.weeks[4]?.[1]?.day).toBe('2026-11-30');
    expect(month.weeks[4]?.[2]).toBeNull();
  });

  it('adds up only that month', () => {
    expect(month.totalMinutes).toBe(990);
    expect(month.activeDays).toBe(3);
    expect(month.averageMinutes).toBe(330);
    expect(month.best?.day).toBe('2026-11-10');
    expect(month.best?.level).toBe(6);
  });

  it('marks today and the days still to come', () => {
    const cells = month.weeks.flat();
    expect(cells.find((c) => c?.isToday)?.day).toBe('2026-11-24');
    expect(cells.find((c) => c?.day === '2026-11-25')?.isFuture).toBe(true);
  });

  it('pads a month that starts mid-week', () => {
    const december = buildHoursMonth(byDay, '2026-12', '2026-11-24');
    expect(december.weeks[0]?.slice(0, 2)).toEqual([null, null]);
    expect(december.weeks[0]?.[2]?.day).toBe('2026-12-01');
    expect(december.best).toBeNull();
    expect(december.averageMinutes).toBe(0);
  });
});

describe('months', () => {
  it('moves across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('finds the first month with time', () => {
    expect(
      firstMonth(
        new Map([
          ['2026-03-04', 10],
          ['2025-12-01', 0],
        ]),
        '2026-11-24',
      ),
    ).toBe('2026-03');
    expect(firstMonth(new Map(), '2026-11-24')).toBe('2026-11');
  });
});
