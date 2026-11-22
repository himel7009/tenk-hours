import { describe, expect, it } from 'vitest';
import {
  buildDayPlan,
  buildWeekPlan,
  describeRoutine,
  changeDay,
  dayChangeOf,
  domainPlan,
  inheritDomainRoutines,
  isDomainPlannedOn,
  isPlannedOn,
  isRequiredOn,
  normalizeDayList,
  normalizeRoutine,
  planOf,
  setWeekday,
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

  it('follows its own days, in a domain or not', () => {
    expect(routineOf({ routineDays: [3] }).days).toEqual([3]);
    const ml = { routineDays: [0] as Weekday[], skippedDays: ['2026-11-22'] };
    // 2026-11-22 is a Sunday.
    expect(isPlannedOn(routineOf(ml), '2026-11-22')).toBe(false);
  });

  it('puts a domain on when any of its trackers is', () => {
    const ml = { routineDays: [0] as Weekday[] };
    const dl = { routineDays: [2] as Weekday[], addedDays: ['2026-11-23'] };
    expect(isDomainPlannedOn([ml, dl], '2026-11-22')).toBe(true);
    expect(isDomainPlannedOn([ml, dl], '2026-11-23')).toBe(true);
    expect(isDomainPlannedOn([ml, dl], '2026-11-25')).toBe(false);
    expect(isDomainPlannedOn([], '2026-11-22')).toBe(false);
    expect(domainPlan([ml, dl])).toEqual({ days: [0, 2], added: ['2026-11-23'], skipped: [] });
    expect(domainPlan([ml, { routineDays: [] }]).days).toEqual([]);
  });

  it("hands a domain's days and changes to its trackers", () => {
    const domains = [{ id: 'ai', routineDays: [0, 2] as Weekday[], skippedDays: ['2026-11-22'] }];
    const trackers = [
      { id: 'ml', domainId: 'ai', routineDays: [] as Weekday[], addedDays: ['2026-11-23'] },
      { id: 'run', domainId: null, routineDays: [1] as Weekday[] },
    ];
    expect(inheritDomainRoutines(trackers, domains)).toEqual([
      {
        id: 'ml',
        domainId: 'ai',
        routineDays: [0, 2],
        addedDays: ['2026-11-23'],
        skippedDays: ['2026-11-22'],
      },
      trackers[1],
    ]);
  });

  it('describes a routine', () => {
    expect(describeRoutine([])).toBe('Every day');
    expect(describeRoutine([0, 2])).toMatch(/^Sun and Tue$/);
  });
});

describe('buildWeekPlan', () => {
  it('lists domains on the days any of their trackers is, and standalone trackers', () => {
    const ai = { id: 'ai', name: 'AI', icon: '🤖', color: 'plum' };
    const empty = { id: 'e', name: 'Empty', icon: '📦', color: 'teal' };
    const tracker = (id: string, domainId: string | null, routineDays: Weekday[]) => ({
      id,
      name: id,
      icon: '🎯',
      color: 'rose',
      domainId,
      routineDays,
    });
    const plan = buildWeekPlan(
      [ai, empty],
      [
        tracker('ml', 'ai', [0]),
        tracker('dl', 'ai', [2]),
        tracker('guitar', null, [0, 1]),
        tracker('writing', null, []),
      ],
    );
    expect(plan.days[0]?.entries.map((e) => e.id)).toEqual(['ai', 'guitar']);
    expect(plan.days[1]?.entries.map((e) => e.id)).toEqual(['guitar']);
    expect(plan.days[2]?.entries.map((e) => e.id)).toEqual(['ai']);
    // Skills are not listed on their own, and an empty domain is never on.
    expect(plan.days[3]?.entries).toEqual([]);
    expect(plan.everyDay).toBe(1);
  });
});

describe('day changes in the week and day plans', () => {
  // The week of Sunday 2026-11-22.
  const week = ['22', '23', '24', '25', '26', '27', '28'].map((d) => `2026-11-${d}`);
  const ai = { id: 'ai', name: 'AI', icon: '🤖', color: 'plum' };
  const ps = { id: 'ps', name: 'Problem solving', icon: '🧩', color: 'moss' };
  const tracker = (
    id: string,
    name: string,
    domainId: string | null,
    routineDays: Weekday[],
    extra: { addedDays?: string[]; skippedDays?: string[] } = {},
  ) => ({
    id,
    name,
    icon: '🎯',
    color: 'rose',
    domainId,
    kind: (domainId ? 'skill' : 'habit') as 'skill' | 'habit',
    routineDays,
    ...extra,
  });
  // Machine learning skipped and competitive programming added on Sunday.
  const trackers = [
    tracker('ml', 'Machine learning', 'ai', [0], { skippedDays: ['2026-11-22'] }),
    tracker('cp', 'Competitive programming', 'ps', [1], { addedDays: ['2026-11-22'] }),
    tracker('run', 'Running', null, []),
  ];

  it('swaps AI for problem solving on Sunday in the week', () => {
    const plan = buildWeekPlan([ai, ps], trackers, week);
    expect(plan.days[0]?.entries.map((e) => [e.id, e.change])).toEqual([
      ['ai', 'skipped'],
      ['ps', 'added'],
    ]);
    expect(plan.days[1]?.entries.map((e) => e.id)).toEqual(['ps']);
    expect(plan.everyDay).toBe(1);
  });

  it("splits a day's plan into on and off, tracker by tracker", () => {
    const day = buildDayPlan([ai, ps], trackers, '2026-11-22');
    expect(day.on.map((r) => [r.id, r.state, r.domain])).toEqual([
      ['cp', 'added', 'Problem solving'],
      ['run', 'routine', null],
    ]);
    expect(day.off.map((r) => [r.id, r.state])).toEqual([['ml', 'skipped']]);
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
});

describe('setWeekday', () => {
  it('turns a day on or off, never down to no days', () => {
    expect(setWeekday([0], 2, true)).toEqual([0, 2]);
    expect(setWeekday([], 0, false)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(setWeekday([3], 3, false)).toEqual([3]);
    expect(setWeekday([1, 2, 3, 4, 5, 6], 0, true)).toEqual([]);
  });
});
