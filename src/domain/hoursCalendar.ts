import { addDays, fromDayKey, type DayKey } from './dates';

/** How bright a day is: 0 for nothing, up to 6 for ten hours or more. */
export type HoursLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Fixed steps of total hours in a day, so a colour or emoji always means the
 * same amount of work, month after month.
 */
export const HOUR_STEPS: readonly {
  level: Exclude<HoursLevel, 0>;
  fromHours: number;
  emoji: string;
}[] = [
  { level: 1, fromHours: 0, emoji: '🌱' },
  { level: 2, fromHours: 2, emoji: '🌿' },
  { level: 3, fromHours: 4, emoji: '🌳' },
  { level: 4, fromHours: 6, emoji: '🔥' },
  { level: 5, fromHours: 8, emoji: '🚀' },
  { level: 6, fromHours: 10, emoji: '👑' },
];

export function hoursLevel(minutes: number): HoursLevel {
  if (minutes <= 0) return 0;
  let level: HoursLevel = 1;
  for (const step of HOUR_STEPS) if (minutes >= step.fromHours * 60) level = step.level;
  return level;
}

export function levelEmoji(level: HoursLevel): string {
  return HOUR_STEPS.find((step) => step.level === level)?.emoji ?? '';
}

/** "Under 2h", "2–4h", "10h+". */
export function levelRange(level: Exclude<HoursLevel, 0>): string {
  const index = HOUR_STEPS.findIndex((step) => step.level === level);
  const step = HOUR_STEPS[index];
  const next = HOUR_STEPS[index + 1];
  if (!step) return '';
  if (step.fromHours === 0) return `Under ${next?.fromHours ?? 0}h`;
  return next ? `${step.fromHours}–${next.fromHours}h` : `${step.fromHours}h+`;
}

export interface MonthDay {
  day: DayKey;
  minutes: number;
  level: HoursLevel;
  isToday: boolean;
  isFuture: boolean;
}

export interface HoursMonth {
  /** 'YYYY-MM'. */
  month: string;
  /** Weeks Sunday to Saturday; null pads days outside the month. */
  weeks: (MonthDay | null)[][];
  totalMinutes: number;
  activeDays: number;
  /** Per active day, so a few days off do not drag it down. */
  averageMinutes: number;
  best: MonthDay | null;
}

export const monthOf = (day: DayKey): string => day.slice(0, 7);

/** 'YYYY-MM' moved by whole months. */
export function shiftMonth(month: string, by: number): string {
  const [y = 1970, m = 1] = month.split('-').map(Number);
  const date = new Date(y, m - 1 + by, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** One calendar month of total time per day, for the hours calendar. */
export function buildHoursMonth(
  byDay: ReadonlyMap<DayKey, number>,
  month: string,
  today: DayKey,
): HoursMonth {
  const first = `${month}-01`;
  const lead = fromDayKey(first).getDay();
  const cells: (MonthDay | null)[] = Array.from({ length: lead }, () => null);
  let totalMinutes = 0;
  let activeDays = 0;
  let best: MonthDay | null = null;
  for (let day = first; monthOf(day) === month; day = addDays(day, 1)) {
    const minutes = byDay.get(day) ?? 0;
    const cell: MonthDay = {
      day,
      minutes,
      level: hoursLevel(minutes),
      isToday: day === today,
      isFuture: day > today,
    };
    cells.push(cell);
    totalMinutes += minutes;
    if (minutes > 0) {
      activeDays += 1;
      if (!best || minutes > best.minutes) best = cell;
    }
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (MonthDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return {
    month,
    weeks,
    totalMinutes,
    activeDays,
    averageMinutes: activeDays === 0 ? 0 : totalMinutes / activeDays,
    best,
  };
}

/** The earliest month with any time, or this month when there is none. */
export function firstMonth(byDay: ReadonlyMap<DayKey, number>, today: DayKey): string {
  let earliest = today;
  for (const [day, minutes] of byDay) if (minutes > 0 && day < earliest) earliest = day;
  return monthOf(earliest);
}
