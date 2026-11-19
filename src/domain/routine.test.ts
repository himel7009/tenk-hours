import { describe, expect, it } from 'vitest';
import {
  buildWeekPlan,
  describeRoutine,
  isPlannedOn,
  normalizeRoutine,
  routineOf,
  toggleWeekday,
} from './routine';

describe('routine', () => {
  it('plans every day when empty', () => {
    expect(isPlannedOn([], '2026-11-19')).toBe(true);
    // 2026-11-19 is a Thursday.
    expect(isPlannedOn([4], '2026-11-19')).toBe(true);
    expect(isPlannedOn([0, 1], '2026-11-19')).toBe(false);
  });

  it('cleans up stored values, and all seven days means every day', () => {
    expect(normalizeRoutine([3, 1, 1, 9, 'x', 2.5])).toEqual([1, 3]);
    expect(normalizeRoutine([0, 1, 2, 3, 4, 5, 6])).toEqual([]);
    expect(normalizeRoutine(null)).toEqual([]);
  });

  it('turning a day off from every day keeps the other six', () => {
    expect(toggleWeekday([], 0)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(toggleWeekday([1, 2, 3, 4, 5, 6], 0)).toEqual([]);
    expect(toggleWeekday([1], 1)).toEqual([]);
  });

  it('follows the domain when the item is in one', () => {
    const domains = [{ id: 'ai', routineDays: [0] as const }];
    expect(routineOf({ domainId: 'ai', routineDays: [3] }, domains)).toEqual([0]);
    expect(routineOf({ domainId: null, routineDays: [3] }, domains)).toEqual([3]);
  });

  it('describes a routine', () => {
    expect(describeRoutine([])).toBe('Every day');
    expect(describeRoutine([0, 2])).toMatch(/^Sun and Tue$/);
  });
});

describe('buildWeekPlan', () => {
  it('lists domains and standalone trackers on their days', () => {
    const ai = { id: 'ai', name: 'AI', icon: '🤖', color: 'plum', routineDays: [0] as const };
    const maths = { id: 'm', name: 'Maths', icon: '📐', color: 'teal', routineDays: [1] as const };
    const all = { id: 'x', name: 'Writing', icon: '✍️', color: 'rose', routineDays: [] as const };
    const trackers = [
      {
        id: 'ml',
        name: 'ML',
        icon: '🧠',
        color: 'plum',
        domainId: 'ai',
        routineDays: [3] as const,
      },
      {
        id: 'g',
        name: 'Guitar',
        icon: '🎸',
        color: 'moss',
        domainId: null,
        routineDays: [0, 1] as const,
      },
    ];
    const plan = buildWeekPlan([ai, maths, all], trackers);
    expect(plan.days[0]?.entries.map((e) => e.id)).toEqual(['ai', 'g']);
    expect(plan.days[1]?.entries.map((e) => e.id)).toEqual(['m', 'g']);
    // ML follows its domain, so it is not listed on its own.
    expect(plan.days[3]?.entries).toEqual([]);
    expect(plan.everyDay).toBe(1);
  });
});
