import { describe, expect, it } from 'vitest';
import { projectStats } from './projectStats';

describe('projectStats', () => {
  const today = '2026-11-18';

  it('totals the last 7 and 30 days and finds the first and last day', () => {
    const byDay = new Map([
      ['2026-10-01', 600],
      ['2026-10-25', 90],
      ['2026-11-12', 60], // the first of the last 7 days
      ['2026-11-11', 45],
      [today, 30],
    ]);
    expect(projectStats(byDay, today)).toEqual({
      weekMinutes: 90,
      monthMinutes: 225,
      daysWorked: 5,
      firstDay: '2026-10-01',
      lastDay: today,
    });
  });

  it('is empty for a project with no sessions', () => {
    expect(projectStats(new Map(), today)).toMatchObject({ weekMinutes: 0, firstDay: null });
  });
});
