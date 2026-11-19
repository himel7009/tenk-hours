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

/** Whether a routine plans for this day. An empty routine plans for every day. */
export function isPlannedOn(routine: readonly Weekday[], day: DayKey): boolean {
  return routine.length === 0 || routine.includes(weekdayOf(day));
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
export function routineOf(
  item: { domainId: string | null; routineDays: readonly Weekday[] },
  domains: readonly { id: string; routineDays: readonly Weekday[] }[],
): readonly Weekday[] {
  if (item.domainId === null) return item.routineDays;
  return domains.find((domain) => domain.id === item.domainId)?.routineDays ?? item.routineDays;
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
}

export interface WeekPlan {
  /** What is planned for each weekday, Sunday first. */
  days: { weekday: Weekday; entries: PlanEntry[] }[];
  /** How many have no routine and so come every day. */
  everyDay: number;
}

/**
 * The routine laid out by weekday: domains, and trackers that stand alone.
 * Items planned for every day are counted rather than listed in all seven.
 */
export function buildWeekPlan(
  domains: readonly {
    id: string;
    name: string;
    icon: string;
    color: string;
    routineDays: readonly Weekday[];
  }[],
  trackers: readonly {
    id: string;
    name: string;
    icon: string;
    color: string;
    domainId: string | null;
    routineDays: readonly Weekday[];
  }[],
): WeekPlan {
  const items: (PlanEntry & { routine: readonly Weekday[] })[] = [
    ...domains.map((domain) => ({
      ...domain,
      type: 'domain' as const,
      routine: domain.routineDays,
    })),
    ...trackers
      .filter((tracker) => tracker.domainId === null)
      .map((tracker) => ({ ...tracker, type: 'tracker' as const, routine: tracker.routineDays })),
  ];
  const scheduled = items.filter((item) => item.routine.length > 0);
  return {
    days: WEEKDAYS.map((weekday) => ({
      weekday,
      entries: scheduled
        .filter((item) => item.routine.includes(weekday))
        .map(({ id, name, icon, color, type }) => ({ id, name, icon, color, type })),
    })),
    everyDay: items.length - scheduled.length,
  };
}
