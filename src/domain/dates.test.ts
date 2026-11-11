import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isDayKey, toDayKey } from './dates';

describe('day keys', () => {
  it('formats a local date', () => {
    expect(toDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('adds days across month ends and leap days', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('measures whole days between keys', () => {
    expect(daysBetween('2026-03-01', '2026-03-10')).toBe(9);
    expect(daysBetween('2026-03-10', '2026-03-01')).toBe(-9);
  });

  it('rejects malformed and impossible dates', () => {
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2026-2-3')).toBe(false);
    expect(isDayKey(20260203)).toBe(false);
    expect(isDayKey('2026-02-03')).toBe(true);
  });
});
