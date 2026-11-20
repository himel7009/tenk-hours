import { stableUuid } from './ids';
import { addDays, daysBetween, type DayKey } from './dates';
import type { SkillColor } from './types';

export type BadHabitId = string;
export type CheckInStatus = 'clean' | 'slipped';

/** Something to stay away from, tracked by a daily yes or no. */
export interface BadHabit {
  id: BadHabitId;
  name: string;
  icon: string;
  color: SkillColor;
  createdAt: number;
}

/** The answer for one bad habit on one day. Days with no answer have no row. */
export interface CheckIn {
  id: string;
  habitId: BadHabitId;
  day: DayKey;
  status: CheckInStatus;
  createdAt: number;
}

export const DEFAULT_BAD_HABIT_ICON = '🚫';

export const BAD_HABIT_ICONS = [
  '🚫',
  '📱',
  '🚬',
  '🍺',
  '🍔',
  '🍩',
  '🥤',
  '☕',
  '🎮',
  '📺',
  '🛒',
  '💸',
  '😴',
  '⏰',
  '🗯️',
  '🤳',
] as const;

/**
 * The id of the check-in for a habit on a day. It is derived from the two, so
 * every device answering for the same day writes the same row and the later
 * answer replaces the earlier one. Formatted as a UUID for the database.
 */
export function checkInId(habitId: BadHabitId, day: DayKey): string {
  return stableUuid(`${habitId}:${day}`);
}

export interface BadHabitProgress {
  /** Answers by day. */
  byDay: Map<DayKey, CheckInStatus>;
  todayStatus: CheckInStatus | null;
  /** Clean days in a row, ending today, or yesterday if today has no answer yet. */
  currentStreak: number;
  longestStreak: number;
  cleanDays: number;
  slippedDays: number;
  /** Share of answered days in the last 30 that were clean, or null if none. */
  cleanRate30: number | null;
  lastSlip: DayKey | null;
}

/**
 * Sums up a bad habit's check-ins. A streak is a run of clean answers on
 * consecutive days: a slip ends it, and so does a day with no answer, since
 * nothing is known about it.
 */
export function summarizeBadHabit(checkIns: readonly CheckIn[], today: DayKey): BadHabitProgress {
  const byDay = new Map<DayKey, CheckInStatus>();
  for (const { day, status } of checkIns) byDay.set(day, status);

  const clean = [...byDay].filter(([, status]) => status === 'clean').map(([day]) => day);
  const slipped = [...byDay].filter(([, status]) => status === 'slipped').map(([day]) => day);
  const todayStatus = byDay.get(today) ?? null;

  let currentStreak = 0;
  let cursor = todayStatus === null ? addDays(today, -1) : today;
  while (byDay.get(cursor) === 'clean') {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  let longestStreak = 0;
  let run = 0;
  let previous: DayKey | null = null;
  for (const day of clean.sort()) {
    run = previous !== null && daysBetween(previous, day) === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }

  const windowStart = addDays(today, -29);
  const recent = [...byDay].filter(([day]) => day >= windowStart && day <= today);
  const recentClean = recent.filter(([, status]) => status === 'clean').length;

  return {
    byDay,
    todayStatus,
    currentStreak,
    longestStreak,
    cleanDays: clean.length,
    slippedDays: slipped.length,
    cleanRate30: recent.length === 0 ? null : recentClean / recent.length,
    lastSlip: slipped.sort().at(-1) ?? null,
  };
}
