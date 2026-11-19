import { addDays, daysBetween, fromDayKey, toDayKey, type DayKey } from './dates';

/** Which stretch of days a calendar shows. */
export type ActivityRange = { kind: 'year-to-date' } | { kind: 'year'; year: number };

export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

export interface ActivityDay {
  day: DayKey;
  minutes: number;
  level: ActivityLevel;
  future: boolean;
}

export interface ActivityCalendar {
  /** Columns of seven, Sunday at the top. Days outside the range are null. */
  weeks: (ActivityDay | null)[][];
  /** Where each month starts, by week column. */
  months: { label: string; week: number }[];
  totalMinutes: number;
  activeDays: number;
  /** Most days in a row with any time, within the range. */
  longestRun: number;
  /** Days in a row with time, ending today or yesterday. Zero for past years. */
  currentRun: number;
  start: DayKey;
  end: DayKey;
}

/**
 * Shading like GitHub's. With a daily goal the levels mean something fixed:
 * some time, half the goal, the goal, twice the goal. Without one they are
 * quarters of the busiest days shown, so a light month still has contrast.
 */
export function levelScale(
  minutes: readonly number[],
  goalMinutes: number | null,
): (minutes: number) => ActivityLevel {
  if (goalMinutes !== null) {
    return (value) =>
      value <= 0
        ? 0
        : value < goalMinutes / 2
          ? 1
          : value < goalMinutes
            ? 2
            : value < goalMinutes * 2
              ? 3
              : 4;
  }
  const active = minutes.filter((value) => value > 0).sort((a, b) => a - b);
  const quantile = (q: number) => active[Math.max(0, Math.ceil(q * active.length) - 1)] ?? 0;
  const [q1, q2, q3] = [quantile(0.25), quantile(0.5), quantile(0.75)];
  return (value) => (value <= 0 ? 0 : value <= q1 ? 1 : value <= q2 ? 2 : value <= q3 ? 3 : 4);
}

/**
 * A year of days laid out in week columns. `year-to-date` is the last 53
 * weeks ending today, the way GitHub shows a profile.
 */
export function buildActivityCalendar(
  byDay: ReadonlyMap<DayKey, number>,
  range: ActivityRange,
  today: DayKey,
  goalMinutes: number | null = null,
): ActivityCalendar {
  let start: DayKey;
  let end: DayKey;
  if (range.kind === 'year') {
    start = toDayKey(new Date(range.year, 0, 1, 12));
    end = toDayKey(new Date(range.year, 11, 31, 12));
  } else {
    end = today;
    // 52 full weeks back, starting on a Sunday, plus this week so far.
    start = addDays(today, -(52 * 7 + fromDayKey(today).getDay()));
  }

  const length = daysBetween(start, end) + 1;
  const days = Array.from({ length }, (_, index) => addDays(start, index));
  const minutes = days.map((day) => (day <= today ? (byDay.get(day) ?? 0) : 0));
  const level = levelScale(minutes, goalMinutes);

  const lead = fromDayKey(start).getDay();
  const cells: (ActivityDay | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...days.map((day, index) => ({
      day,
      minutes: minutes[index]!,
      level: level(minutes[index]!),
      future: day > today,
    })),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, week) =>
    cells.slice(week * 7, week * 7 + 7),
  );

  const months: ActivityCalendar['months'] = [];
  weeks.forEach((week, index) => {
    const first = week.find((cell) => cell && fromDayKey(cell.day).getDate() === 1);
    if (first) {
      months.push({
        label: fromDayKey(first.day).toLocaleDateString(undefined, { month: 'short' }),
        week: index,
      });
    }
  });

  let longestRun = 0;
  let run = 0;
  for (const value of minutes) {
    run = value > 0 ? run + 1 : 0;
    longestRun = Math.max(longestRun, run);
  }
  let currentRun = 0;
  if (today >= start && today <= end) {
    let cursor = (byDay.get(today) ?? 0) > 0 ? today : addDays(today, -1);
    while (cursor >= start && (byDay.get(cursor) ?? 0) > 0) {
      currentRun += 1;
      cursor = addDays(cursor, -1);
    }
  }

  return {
    weeks,
    months,
    totalMinutes: minutes.reduce((sum, value) => sum + value, 0),
    activeDays: minutes.filter((value) => value > 0).length,
    longestRun,
    currentRun,
    start,
    end,
  };
}

/** Years that have any time, newest first, always including this one. */
export function activityYears(byDay: ReadonlyMap<DayKey, number>, today: DayKey): number[] {
  const years = new Set([fromDayKey(today).getFullYear()]);
  for (const [day, minutes] of byDay) if (minutes > 0) years.add(fromDayKey(day).getFullYear());
  return [...years].sort((a, b) => b - a);
}

/** Adds up several trackers' minutes by day. */
export function combineByDay(maps: Iterable<ReadonlyMap<DayKey, number>>): Map<DayKey, number> {
  const total = new Map<DayKey, number>();
  for (const map of maps) {
    for (const [day, minutes] of map) total.set(day, (total.get(day) ?? 0) + minutes);
  }
  return total;
}
