import { fromDayKey, type DayKey } from './dates';

/**
 * A day of the week, as Date.getDay() numbers them: 0 is Sunday. A routine is
 * the list of weekdays something is planned for; an empty list means every
 * day, which is how everything starts.
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** In the order the routine is shown: the week starting on Sunday. */
export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export function weekdayOf(day: DayKey): Weekday {
  return fromDayKey(day).getDay() as Weekday;
}

/** Cleans up a routine from storage, a backup or the server. */
export function normalizeRoutine(value: unknown): Weekday[] {
  if (!Array.isArray(value)) return [];
  const days = new Set(
    value.filter((day): day is Weekday => Number.isInteger(day) && day >= 0 && day <= 6),
  );
  // All seven is the same as every day.
  return days.size === 7 ? [] : [...days].sort();
}

/**
 * A weekly routine plus changes for single days: days `added` on top of the
 * routine ("do problem solving today too") and days `skipped` ("not AI
 * today"). Changes belong to whatever holds the routine: a domain, or a
 * tracker outside one.
 */
export interface Plan {
  days: readonly Weekday[];
  added?: readonly DayKey[];
  skipped?: readonly DayKey[];
}

/** A bare weekly routine or a plan with day changes. */
export type Routine = readonly Weekday[] | Plan;

function asPlan(routine: Routine): Plan {
  return Array.isArray(routine) ? { days: routine as readonly Weekday[] } : (routine as Plan);
}

function onWeekly(days: readonly Weekday[], day: DayKey): boolean {
  return days.length === 0 || days.includes(weekdayOf(day));
}

/**
 * Whether something is on for this day: the weekly routine (empty plans every
 * day), plus days added, less days skipped. This decides what Today, the
 * week and the to-do list show.
 */
export function isPlannedOn(routine: Routine, day: DayKey): boolean {
  const plan = asPlan(routine);
  if (plan.skipped?.includes(day)) return false;
  return onWeekly(plan.days, day) || (plan.added?.includes(day) ?? false);
}

/**
 * Whether missing this day's goal breaks the streak: the weekly routine less
 * skipped days. An added day is a bonus: reaching its goal counts like any
 * day off, missing it costs nothing.
 */
export function isRequiredOn(routine: Routine, day: DayKey): boolean {
  const plan = asPlan(routine);
  return onWeekly(plan.days, day) && !(plan.skipped?.includes(day) ?? false);
}

/** How a day differs from the weekly routine, if it does. */
export function dayChangeOf(routine: Routine, day: DayKey): 'added' | 'skipped' | null {
  const plan = asPlan(routine);
  if (plan.skipped?.includes(day) && onWeekly(plan.days, day)) return 'skipped';
  if (plan.added?.includes(day) && !onWeekly(plan.days, day)) return 'added';
  return null;
}

/** Whether the weekly routine alone plans this day. */
export function isOnRoutine(routine: Routine, day: DayKey): boolean {
  return onWeekly(asPlan(routine).days, day);
}

/** Cleans up a list of changed days from storage, a backup or the server. */
export function normalizeDayList(value: unknown): DayKey[] {
  if (!Array.isArray(value)) return [];
  const days = value.filter(
    (day): day is DayKey => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day),
  );
  return [...new Set(days)].sort();
}

/** The plan of whatever holds a routine: its weekdays and day changes. */
export function planOf(item: {
  routineDays: readonly Weekday[];
  addedDays?: readonly DayKey[];
  skippedDays?: readonly DayKey[];
}): Plan {
  return { days: item.routineDays, added: item.addedDays ?? [], skipped: item.skippedDays ?? [] };
}

/**
 * A day changed on a plan: `add` puts it on (only if the routine does not),
 * `skip` takes it off (only if the routine has it), `reset` goes back to the
 * routine. Returns the new lists.
 */
export function changeDay(
  item: {
    routineDays: readonly Weekday[];
    addedDays?: readonly DayKey[];
    skippedDays?: readonly DayKey[];
  },
  day: DayKey,
  change: 'add' | 'skip' | 'reset',
): { addedDays: DayKey[]; skippedDays: DayKey[] } {
  const added = (item.addedDays ?? []).filter((d) => d !== day);
  const skipped = (item.skippedDays ?? []).filter((d) => d !== day);
  const weekly = onWeekly(item.routineDays, day);
  if (change === 'add' && !weekly) added.push(day);
  if (change === 'skip' && weekly) skipped.push(day);
  return { addedDays: added.sort(), skippedDays: skipped.sort() };
}

export function toggleWeekday(routine: readonly Weekday[], weekday: Weekday): Weekday[] {
  // Every day is stored as empty, so turning one day off starts from all seven.
  const current = routine.length === 0 ? [...WEEKDAYS] : routine;
  return normalizeRoutine(
    current.includes(weekday) ? current.filter((day) => day !== weekday) : [...current, weekday],
  );
}

/**
 * The routine a tracker follows: its domain's when it is in one, since a
 * domain is planned as a whole, otherwise its own.
 */
type Planned = {
  routineDays: readonly Weekday[];
  addedDays?: readonly DayKey[];
  skippedDays?: readonly DayKey[];
};

export function routineOf(
  item: Planned & { domainId: string | null },
  domains: readonly (Planned & { id: string })[],
): Plan {
  if (item.domainId === null) return planOf(item);
  const domain = domains.find((d) => d.id === item.domainId);
  return planOf(domain ?? item);
}

/** "every day" or "on Sun and Tue", to follow a verb such as "planned". */
export function plannedPhrase(routine: readonly Weekday[]): string {
  return routine.length === 0 ? 'every day' : `on ${describeRoutine(routine)}`;
}

/** "Every day", "Sun, Tue and Thu". */
export function describeRoutine(routine: readonly Weekday[]): string {
  if (routine.length === 0) return 'Every day';
  const names = routine.map((day) =>
    // 2023-01-01 was a Sunday.
    new Date(2023, 0, 1 + day).toLocaleDateString(undefined, { weekday: 'short' }),
  );
  return names.length === 1
    ? names[0]!
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export interface PlanEntry {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** A domain, or a skill, habit or project outside one. */
  type: 'domain' | 'tracker';
  /** Set when that date differs from the routine (only with real dates). */
  change?: 'added' | 'skipped';
}

export interface WeekPlan {
  /** What is planned for each weekday, Sunday first. */
  days: { weekday: Weekday; entries: PlanEntry[] }[];
  /** How many have no routine and so come every day. */
  everyDay: number;
}

type Look = { id: string; name: string; icon: string; color: string };

/**
 * The routine laid out by weekday: domains, and trackers that stand alone.
 * Items planned for every day are counted rather than listed in all seven.
 * Given the week's real dates (Sunday first), day changes are applied: added
 * items join that day and skipped ones are kept, marked, so the gap shows.
 */
export function buildWeekPlan(
  domains: readonly (Look & Planned)[],
  trackers: readonly (Look & Planned & { domainId: string | null })[],
  week?: readonly DayKey[],
): WeekPlan {
  const items: (PlanEntry & { plan: Plan })[] = [
    ...domains.map((domain) => ({ ...domain, type: 'domain' as const, plan: planOf(domain) })),
    ...trackers
      .filter((tracker) => tracker.domainId === null)
      .map((tracker) => ({ ...tracker, type: 'tracker' as const, plan: planOf(tracker) })),
  ];
  const scheduled = items.filter((item) => item.plan.days.length > 0);
  const entry = (item: PlanEntry, change?: 'added' | 'skipped'): PlanEntry => ({
    id: item.id,
    name: item.name,
    icon: item.icon,
    color: item.color,
    type: item.type,
    ...(change ? { change } : {}),
  });
  return {
    days: WEEKDAYS.map((weekday) => {
      const date = week?.[weekday];
      if (date === undefined) {
        return {
          weekday,
          entries: scheduled.filter((i) => i.plan.days.includes(weekday)).map((i) => entry(i)),
        };
      }
      const entries: PlanEntry[] = [];
      for (const item of items) {
        const change = dayChangeOf(item.plan, date);
        if (change) entries.push(entry(item, change));
        else if (item.plan.days.length > 0 && item.plan.days.includes(weekday)) {
          entries.push(entry(item));
        }
      }
      return { weekday, entries };
    }),
    everyDay: items.length - scheduled.length,
  };
}

export interface DayPlanRow extends Look {
  target: { domainId: string } | { skillId: string };
  kind: 'domain' | 'skill' | 'habit' | 'project';
  /** On the routine, added for the day, skipped for the day, or off. */
  state: 'routine' | 'added' | 'skipped' | 'off';
  /** For a domain: the skills and projects that come with it. */
  inside: string[];
}

/**
 * Everything whose plan can change for a day (domains, and trackers outside
 * one), split into what is on that day and what is not.
 */
export function buildDayPlan(
  domains: readonly (Look & Planned)[],
  trackers: readonly (Look &
    Planned & { domainId: string | null; kind: 'skill' | 'habit' | 'project' })[],
  day: DayKey,
): { on: DayPlanRow[]; off: DayPlanRow[] } {
  const row = (
    item: Look & Planned,
    target: DayPlanRow['target'],
    kind: DayPlanRow['kind'],
    inside: string[],
  ): DayPlanRow => {
    const plan = planOf(item);
    const change = dayChangeOf(plan, day);
    const state = change ?? (isPlannedOn(plan, day) ? 'routine' : 'off');
    const { id, name, icon, color } = item;
    return { id, name, icon, color, target, kind, state, inside };
  };
  const rows = [
    ...domains.map((domain) =>
      row(
        domain,
        { domainId: domain.id },
        'domain',
        trackers.filter((t) => t.domainId === domain.id).map((t) => t.name),
      ),
    ),
    ...trackers
      .filter((tracker) => tracker.domainId === null)
      .map((tracker) => row(tracker, { skillId: tracker.id }, tracker.kind, [])),
  ];
  return {
    on: rows.filter((r) => r.state === 'routine' || r.state === 'added'),
    off: rows.filter((r) => r.state === 'skipped' || r.state === 'off'),
  };
}
