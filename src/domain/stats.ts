import { addDays, daysBetween, type DayKey } from './dates';
import type { Session } from './types';

const PACE_WINDOW_DAYS = 30;

export function totalMinutes(sessions: readonly Session[]): number {
  return sessions.reduce((sum, session) => sum + session.minutes, 0);
}

export function minutesByDay(sessions: readonly Session[]): Map<DayKey, number> {
  const byDay = new Map<DayKey, number>();
  for (const { day, minutes } of sessions) {
    byDay.set(day, (byDay.get(day) ?? 0) + minutes);
  }
  return byDay;
}

/**
 * Average minutes per day over the last 30 days. If the first session is more
 * recent than that, the window shrinks so a new skill isn't diluted by days
 * before it existed.
 */
export function dailyPace(byDay: ReadonlyMap<DayKey, number>, today: DayKey): number {
  if (byDay.size === 0) return 0;
  const firstDay = [...byDay.keys()].sort()[0]!;
  const windowDays = Math.min(PACE_WINDOW_DAYS, Math.max(1, daysBetween(firstDay, today) + 1));
  const windowStart = addDays(today, -(windowDays - 1));

  let minutes = 0;
  for (const [day, value] of byDay) {
    if (day >= windowStart && day <= today) minutes += value;
  }
  return minutes / windowDays;
}

/** The day the target is reached at the given pace, or null if there is no pace. */
export function projectFinish(
  loggedMinutes: number,
  targetHours: number,
  paceMinutesPerDay: number,
  today: DayKey,
): DayKey | null {
  const remaining = targetHours * 60 - loggedMinutes;
  if (remaining <= 0) return today;
  if (paceMinutesPerDay <= 0) return null;
  const days = Math.ceil(remaining / paceMinutesPerDay);
  // Beyond ~270 years the Date maths is meaningless anyway.
  return days > 100_000 ? null : addDays(today, days);
}
