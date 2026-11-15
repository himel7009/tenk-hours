import { describe, expect, it } from 'vitest';
import { dayProgress, daysLeftInYear, monthFractions, yearProgress } from './timeProgress';

describe('dayProgress', () => {
  it('is zero at midnight and a quarter at 6am', () => {
    expect(dayProgress(new Date(2026, 10, 15, 0, 0)).fraction).toBe(0);
    const sixAm = dayProgress(new Date(2026, 10, 15, 6, 0));
    expect(sixAm.fraction).toBeCloseTo(0.25);
    expect(sixAm.remainingMs).toBe(18 * 3_600_000);
  });
});

describe('yearProgress', () => {
  it('is zero on new year and half way at the start of 2 July in a normal year', () => {
    expect(yearProgress(new Date(2026, 0, 1)).fraction).toBe(0);
    // 182 of 365 days have passed at midnight on 2 July.
    expect(yearProgress(new Date(2026, 6, 2)).fraction).toBeCloseTo(182 / 365, 3);
  });

  it('accounts for leap years', () => {
    expect(yearProgress(new Date(2028, 6, 2)).fraction).toBeCloseTo(183 / 366, 3);
  });
});

describe('monthFractions', () => {
  it('fills past months, part of the current one and none of the rest', () => {
    const months = monthFractions(new Date(2026, 10, 16)); // 15 of 30 November days gone
    expect(months.slice(0, 10)).toEqual(Array(10).fill(1));
    expect(months[10]).toBeCloseTo(0.5);
    expect(months[11]).toBe(0);
  });
});

describe('daysLeftInYear', () => {
  it('counts the days after today', () => {
    expect(daysLeftInYear(new Date(2026, 11, 31, 23, 0))).toBe(0);
    expect(daysLeftInYear(new Date(2026, 10, 15, 21, 0))).toBe(46);
  });
});
