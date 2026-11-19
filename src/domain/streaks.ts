import { addDays, daysBetween, type DayKey } from './dates';

export interface Streak {
  /** Consecutive days ending today, or yesterday if today has no time yet. */
  current: number;
  longest: number;
  loggedToday: boolean;
}

/**
 * Counts the days in a row that reached the goal. A planned day off
 * (`isDayOff`) neither counts nor breaks the run, unless time was put in
 * anyway, in which case it counts like any other day.
 */
export function computeStreak(
  activeDays: ReadonlySet<DayKey>,
  today: DayKey,
  isDayOff: (day: DayKey) => boolean = () => false,
): Streak {
  const loggedToday = activeDays.has(today);
  const counts = (day: DayKey) => activeDays.has(day);
  const skipped = (day: DayKey) => !counts(day) && isDayOff(day);
  const earliest = [...activeDays].sort()[0];

  let current = 0;
  let cursor = loggedToday ? today : addDays(today, -1);
  while (earliest !== undefined && cursor >= earliest) {
    if (counts(cursor)) current += 1;
    else if (!skipped(cursor)) break;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  if (earliest !== undefined) {
    const last = [...activeDays].sort().at(-1)!;
    const length = daysBetween(earliest, last) + 1;
    for (let index = 0; index < length; index += 1) {
      const day = addDays(earliest, index);
      if (counts(day)) longest = Math.max(longest, (run += 1));
      else if (!skipped(day)) run = 0;
    }
  }

  return { current, longest, loggedToday };
}
