import { describe, expect, it } from 'vitest';
import {
  buildDayPlan,
  buildWeekPlan,
  describeRoutine,
  changeDay,
  dayChangeOf,
  isPlannedOn,
  isRequiredOn,
  normalizeDayList,
  normalizeRoutine,
  planOf,
  routineOf,
  toggleWeekday,
  type Weekday,
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
    expect(routineOf({ domainId: 'ai', routineDays: [3] }, domains).days).toEqual([0]);
    expect(routineOf({ domainId: null, routineDays: [3] }, domains).days).toEqual([3]);
  });

  it("follows the domain's day changes too", () => {
    const domains = [{ id: 'ai', routineDays: [0] as const, skippedDays: ['2026-11-22'] }];
    // 2026-11-22 is a Sunday.
    const plan = routineOf({ domainId: 'ai', routineDays: [], addedDays: ['2026-11-23'] }, domains);
    expect(isPlannedOn(plan, '2026-11-22')).toBe(false);
    expect(isPlannedOn(plan, '2026-11-23')).toBe(false);
  });
});

describe('changing a single day', () => {
  // Machine learning on Sundays; 2026-11-22 is a Sunday, 2026-11-23 a Monday.
  const ml = { routineDays: [0] as Weekday[] };

  it('adds a day off to the plan as a bonus that never breaks a streak', () => {
    const changed = changeDay(ml, '2026-11-23', 'add');
    expect(changed).toEqual({ addedDays: ['2026-11-23'], skippedDays: [] });
    const plan = planOf({ ...ml, ...changed });
    expect(isPlannedOn(plan, '2026-11-23')).toBe(true);
    expect(isRequiredOn(plan, '2026-11-23')).toBe(false);
    expect(dayChangeOf(plan, '2026-11-23')).toBe('added');
  });

  it('skips a planned day, so it neither shows nor breaks the streak', () => {
    const plan = planOf({ ...ml, ...changeDay(ml, '2026-11-22', 'skip') });
    expect(isPlannedOn(plan, '2026-11-22')).toBe(false);
    expect(isRequiredOn(plan, '2026-11-22')).toBe(false);
    expect(dayChangeOf(plan, '2026-11-22')).toBe('skipped');
    // Next Sunday is untouched.
    expect(isPlannedOn(plan, '2026-11-29')).toBe(true);
  });

  it('ignores changes that match the routine, and resets', () => {
    expect(changeDay(ml, '2026-11-22', 'add')).toEqual({ addedDays: [], skippedDays: [] });
    expect(changeDay(ml, '2026-11-23', 'skip')).toEqual({ addedDays: [], skippedDays: [] });
    const skipped = { ...ml, skippedDays: ['2026-11-22'] };
    expect(changeDay(skipped, '2026-11-22', 'reset')).toEqual({ addedDays: [], skippedDays: [] });
  });

  it('cleans day lists from outside', () => {
    expect(normalizeDayList(['2026-11-23', 'x', '2026-11-22', '2026-11-23', 4])).toEqual([
      '2026-11-22',
      '2026-11-23',
    ]);
    expect(normalizeDayList(null)).toEqual([]);
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

describe('day changes in the week and day plans', () => {
  // The week of Sunday 2026-11-22.
  const week = ['22', '23', '24', '25', '26', '27', '28'].map((d) => `2026-11-${d}`);
  const ai = { id: 'ai', name: 'AI', icon: '🤖', color: 'plum', routineDays: [0] as Weekday[] };
  const ps = {
    id: 'ps',
    name: 'Problem solving',
    icon: '🧩',
    color: 'moss',
    routineDays: [1] as Weekday[],
  };
  const ml = {
    id: 'ml',
    name: 'Machine learning',
    icon: '🧠',
    color: 'plum',
    domainId: 'ai',
    kind: 'skill' as const,
    routineDays: [] as Weekday[],
  };
  const run = {
    id: 'run',
    name: 'Running',
    icon: '🏃',
    color: 'teal',
    domainId: null,
    kind: 'habit' as const,
    routineDays: [] as Weekday[],
  };

  it('swaps AI for problem solving on Sunday in the week', () => {
    const plan = buildWeekPlan(
      [
        { ...ai, skippedDays: ['2026-11-22'] },
        { ...ps, addedDays: ['2026-11-22'] },
      ],
      [ml, run],
      week,
    );
    expect(plan.days[0]?.entries.map((e) => [e.id, e.change])).toEqual([
      ['ai', 'skipped'],
      ['ps', 'added'],
    ]);
    expect(plan.days[1]?.entries.map((e) => e.id)).toEqual(['ps']);
    expect(plan.everyDay).toBe(1);
  });

  it("splits a day's plan into on and off", () => {
    const day = buildDayPlan(
      [
        { ...ai, skippedDays: ['2026-11-22'] },
        { ...ps, addedDays: ['2026-11-22'] },
      ],
      [ml, run],
      '2026-11-22',
    );
    expect(day.on.map((r) => [r.id, r.state])).toEqual([
      ['ps', 'added'],
      ['run', 'routine'],
    ]);
    expect(day.off).toEqual([
      expect.objectContaining({ id: 'ai', state: 'skipped', inside: ['Machine learning'] }),
    ]);
  });
});
