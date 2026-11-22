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

/**
 * Turns one weekday on or off. Turning off the last day leaves the routine
 * as it was, since no days at all would mean every day.
 */
export function setWeekday(routine: readonly Weekday[], weekday: Weekday, on: boolean): Weekday[] {
  const current = routine.length === 0 ? [...WEEKDAYS] : [...routine];
  const next = on ? [...current, weekday] : current.filter((day) => day !== weekday);
  return next.length === 0 ? normalizeRoutine(routine) : normalizeRoutine(next);
}

export function toggleWeekday(routine: readonly Weekday[], weekday: Weekday): Weekday[] {
  // Every day is stored as empty, so turning one day off starts from all seven.
  const current = routine.length === 0 ? [...WEEKDAYS] : routine;
  return normalizeRoutine(
    current.includes(weekday) ? current.filter((day) => day !== weekday) : [...current, weekday],
  );
}

type Planned = {
  routineDays: readonly Weekday[];
  addedDays?: readonly DayKey[];
  skippedDays?: readonly DayKey[];
};

/**
 * The plan a tracker follows: its own weekdays and day changes. Domains no
 * longer have days of their own; they are on whenever one of their skills is.
 */
export function routineOf(item: Planned): Plan {
  return planOf(item);
}

/** Whether any of a domain's trackers is on that day. */
export function isDomainPlannedOn(members: readonly Planned[], day: DayKey): boolean {
  return members.some((member) => isPlannedOn(planOf(member), day));
}

/** Whether a domain is on the weekly routine that day (ignoring day changes). */
function isDomainOnRoutine(members: readonly Planned[], day: DayKey): boolean {
  return members.some((member) => isOnRoutine(planOf(member), day));
}

/**
 * A domain's plan as one routine: the weekdays any member is on (every day
 * when that is all seven) and their added days. Only for things that still
 * point at a domain, such as old to-dos.
 */
export function domainPlan(members: readonly Planned[]): Plan {
  const days = new Set<Weekday>();
  for (const member of members) {
    for (const day of member.routineDays.length === 0 ? WEEKDAYS : member.routineDays) {
      days.add(day);
    }
  }
  return {
    days: members.length === 0 ? [] : normalizeRoutine([...days]),
    added: normalizeDayList(members.flatMap((member) => member.addedDays ?? [])),
    skipped: [],
  };
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
 * The routine laid out by weekday: domains (on when any of their trackers
 * is) and trackers outside a domain. Items on every day are counted rather
 * than listed in all seven. Given the week's real dates (Sunday first), day
 * changes are applied: added items join that day and skipped ones are kept,
 * marked, so the gap shows.
 */
export function buildWeekPlan(
  domains: readonly Look[],
  trackers: readonly (Look & Planned & { domainId: string | null })[],
  week?: readonly DayKey[],
): WeekPlan {
  type Item = {
    entry: PlanEntry;
    onWeekday: (weekday: Weekday) => boolean;
    onRoutine: (day: DayKey) => boolean;
    planned: (day: DayKey) => boolean;
  };
  const items: Item[] = [
    ...domains.map((domain): Item => {
      const members = trackers.filter((tracker) => tracker.domainId === domain.id);
      return {
        entry: { ...pick(domain), type: 'domain' },
        onWeekday: (weekday) =>
          members.some((m) => m.routineDays.length === 0 || m.routineDays.includes(weekday)),
        onRoutine: (day) => isDomainOnRoutine(members, day),
        planned: (day) => isDomainPlannedOn(members, day),
      };
    }),
    ...trackers
      .filter((tracker) => tracker.domainId === null)
      .map((tracker): Item => {
        const plan = planOf(tracker);
        return {
          entry: { ...pick(tracker), type: 'tracker' },
          onWeekday: (weekday) => plan.days.length === 0 || plan.days.includes(weekday),
          onRoutine: (day) => isOnRoutine(plan, day),
          planned: (day) => isPlannedOn(plan, day),
        };
      }),
  ];
  const everyDay = (item: Item) => WEEKDAYS.every(item.onWeekday);
  return {
    days: WEEKDAYS.map((weekday) => {
      const date = week?.[weekday];
      const entries: PlanEntry[] = [];
      for (const item of items) {
        const daily = everyDay(item);
        if (date === undefined) {
          if (!daily && item.onWeekday(weekday)) entries.push(item.entry);
          continue;
        }
        const routine = item.onRoutine(date);
        const planned = item.planned(date);
        if (routine && !planned) entries.push({ ...item.entry, change: 'skipped' });
        else if (!routine && planned) entries.push({ ...item.entry, change: 'added' });
        else if (planned && !daily) entries.push(item.entry);
      }
      return { weekday, entries };
    }),
    everyDay: items.filter(everyDay).length,
  };
}

function pick(item: Look): Look {
  return { id: item.id, name: item.name, icon: item.icon, color: item.color };
}

export interface DayPlanRow extends Look {
  kind: 'skill' | 'habit' | 'project';
  /** On the routine, added for the day, skipped for the day, or off. */
  state: 'routine' | 'added' | 'skipped' | 'off';
  /** The domain it sits in, if any. */
  domain: string | null;
}

/**
 * Every skill, habit and project, split into what is on that day and what
 * is not, for changing one day of the plan.
 */
export function buildDayPlan(
  domains: readonly (Look & { id: string })[],
  trackers: readonly (Look &
    Planned & { domainId: string | null; kind: 'skill' | 'habit' | 'project' })[],
  day: DayKey,
): { on: DayPlanRow[]; off: DayPlanRow[] } {
  const rows = trackers.map((tracker): DayPlanRow => {
    const plan = planOf(tracker);
    const state = dayChangeOf(plan, day) ?? (isPlannedOn(plan, day) ? 'routine' : 'off');
    const domain = domains.find((d) => d.id === tracker.domainId)?.name ?? null;
    return { ...pick(tracker), kind: tracker.kind, state, domain };
  });
  return {
    on: rows.filter((r) => r.state === 'routine' || r.state === 'added'),
    off: rows.filter((r) => r.state === 'skipped' || r.state === 'off'),
  };
}

/**
 * Hands each domain's weekdays and day changes to the trackers in it, for
 * the move from domain routines to per-tracker ones: nothing a tracker was
 * planned for changes. Trackers outside a domain keep their own.
 */
export function inheritDomainRoutines<
  T extends Planned & { domainId: string | null },
  D extends Planned & { id: string },
>(trackers: readonly T[], domains: readonly D[]): T[] {
  return trackers.map((tracker) => {
    const domain = domains.find((d) => d.id === tracker.domainId);
    if (!domain) return tracker;
    return {
      ...tracker,
      routineDays: [...domain.routineDays],
      addedDays: normalizeDayList([...(domain.addedDays ?? []), ...(tracker.addedDays ?? [])]),
      skippedDays: normalizeDayList([
        ...(domain.skippedDays ?? []),
        ...(tracker.skippedDays ?? []),
      ]),
    };
  });
}
