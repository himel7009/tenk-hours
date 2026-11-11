/** A local calendar day formatted as YYYY-MM-DD. Sorts lexicographically. */
export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses to local noon, which keeps day arithmetic clear of DST shifts. */
export function fromDayKey(key: DayKey): Date {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toDayKey(fromDayKey(value)) === value;
}

export function todayKey(now: Date = new Date()): DayKey {
  return toDayKey(now);
}

export function addDays(key: DayKey, amount: number): DayKey {
  const date = fromDayKey(key);
  date.setDate(date.getDate() + amount);
  return toDayKey(date);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: DayKey, to: DayKey): number {
  const ms = fromDayKey(to).getTime() - fromDayKey(from).getTime();
  return Math.round(ms / 86_400_000);
}
