import { fromDayKey, type DayKey } from './dates';

/** 95 -> "1h 35m", 60 -> "1h", 20 -> "20m". */
export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h.toLocaleString()}h` : `${h.toLocaleString()}h ${m}m`;
}

/** Hours with one decimal below 100h, whole hours above. */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return hours.toLocaleString(undefined, {
    maximumFractionDigits: hours < 100 ? 1 : 0,
  });
}

/** Elapsed milliseconds as H:MM:SS. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDay(day: DayKey, today: DayKey): string {
  if (day === today) return 'Today';
  const date = fromDayKey(day);
  const sameYear = date.getFullYear() === fromDayKey(today).getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
}

export function formatMonthYear(day: DayKey): string {
  return fromDayKey(day).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
