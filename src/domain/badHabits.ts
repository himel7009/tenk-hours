import { stableUuid } from './ids';
import { addDays, daysBetween, toDayKey, type DayKey } from './dates';
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

/** A day on the bad habit's calendar. */
export type BadHabitDay = CheckInStatus | 'unanswered' | 'before' | 'future';

export interface WeekdayRisk {
  weekday: number;
  answered: number;
  slips: number;
  /** Share of answered days that were slips, or null if none answered. */
  slipRate: number | null;
}

export interface BadHabitMonth {
  /** "2026-11". */
  month: string;
  clean: number;
  slipped: number;
  /** Tracked days with no answer (today is not counted until it ends). */
  unanswered: number;
}

export interface BadHabitReport extends BadHabitProgress {
  /** The day tracking began: the day the habit was added. */
  since: DayKey;
  trackedDays: number;
  unansweredDays: number;
  daysSinceLastSlip: number | null;
  /** Typical days between slips, from the gaps between them; null with fewer than two. */
  averageGap: number | null;
  /** Slips in the last 30 days, and in the 30 before. */
  slipsLast30: number;
  slipsPrevious30: number;
  byWeekday: WeekdayRisk[];
  /** The weekday with the highest slip rate, given at least two slips there. */
  riskiestWeekday: WeekdayRisk | null;
  /** The last six months, oldest first, trimmed to when tracking began. */
  months: BadHabitMonth[];
  statusOn: (day: DayKey) => BadHabitDay;
}

const weekdayOfDay = (day: DayKey) => new Date(`${day}T12:00:00`).getDay();

/**
 * Everything the bad habit's page shows: where it stands, when it tends to
 * slip, and how each month went. Built from check-ins; nothing is stored.
 */
export function buildBadHabitReport(
  habit: Pick<BadHabit, 'createdAt'>,
  checkIns: readonly CheckIn[],
  today: DayKey,
): BadHabitReport {
  const summary = summarizeBadHabit(checkIns, today);
  const { byDay } = summary;
  const created = toDayKey(new Date(habit.createdAt));
  // An answer before the habit's own day (a backfill) moves the start back.
  const earliest = [...byDay.keys()].sort()[0];
  const since = earliest !== undefined && earliest < created ? earliest : created;
  const trackedDays = Math.max(1, daysBetween(since, today) + 1);

  // Today only counts as unanswered once it is over.
  let unansweredDays = 0;
  for (let day = since; day < today; day = addDays(day, 1)) {
    if (!byDay.has(day)) unansweredDays += 1;
  }

  const slips = [...byDay]
    .filter(([, s]) => s === 'slipped')
    .map(([d]) => d)
    .sort();
  const gaps = slips.slice(1).map((day, i) => daysBetween(slips[i]!, day));
  const averageGap =
    gaps.length === 0 ? null : Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);

  const inWindow = (from: number, to: number) =>
    slips.filter((day) => day > addDays(today, -from) && day <= addDays(today, -to)).length;

  const byWeekday: WeekdayRisk[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    const answers = [...byDay].filter(([day]) => weekdayOfDay(day) === weekday);
    const slipCount = answers.filter(([, s]) => s === 'slipped').length;
    return {
      weekday,
      answered: answers.length,
      slips: slipCount,
      slipRate: answers.length === 0 ? null : slipCount / answers.length,
    };
  });
  const riskiestWeekday =
    byWeekday
      .filter((w) => w.slips >= 2)
      .sort((a, b) => (b.slipRate ?? 0) - (a.slipRate ?? 0) || b.slips - a.slips)[0] ?? null;

  const months: BadHabitMonth[] = [];
  const [ty, tm] = today.split('-').map(Number) as [number, number];
  for (let back = 5; back >= 0; back -= 1) {
    const date = new Date(ty, tm - 1 - back, 1, 12);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (`${month}-31` < since) continue;
    const row: BadHabitMonth = { month, clean: 0, slipped: 0, unanswered: 0 };
    for (let day = `${month}-01`; day.startsWith(month) && day <= today; day = addDays(day, 1)) {
      if (day < since) continue;
      const status = byDay.get(day);
      if (status === 'clean') row.clean += 1;
      else if (status === 'slipped') row.slipped += 1;
      else if (day < today) row.unanswered += 1;
    }
    months.push(row);
  }

  return {
    ...summary,
    since,
    trackedDays,
    unansweredDays,
    daysSinceLastSlip: summary.lastSlip === null ? null : daysBetween(summary.lastSlip, today),
    averageGap,
    slipsLast30: inWindow(30, 0),
    slipsPrevious30: inWindow(60, 30),
    byWeekday,
    riskiestWeekday,
    months,
    statusOn: (day) => {
      if (day > today) return 'future';
      if (day < since) return 'before';
      return byDay.get(day) ?? 'unanswered';
    },
  };
}
