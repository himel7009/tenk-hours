import { addDays, daysBetween, type DayKey } from './dates';

export interface Streak {
  /** Consecutive days ending today, or yesterday if today has no time yet. */
  current: number;
  longest: number;
  loggedToday: boolean;
}

export function computeStreak(activeDays: ReadonlySet<DayKey>, today: DayKey): Streak {
  const loggedToday = activeDays.has(today);

  let current = 0;
  let cursor = loggedToday ? today : addDays(today, -1);
  while (activeDays.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let previous: DayKey | null = null;
  for (const day of [...activeDays].sort()) {
    run = previous !== null && daysBetween(previous, day) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  return { current, longest, loggedToday };
}
