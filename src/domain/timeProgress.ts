/** How much of a span of time has gone by. */
export interface TimeProgress {
  /** 0 to 1. */
  fraction: number;
  /** Milliseconds until the span ends. */
  remainingMs: number;
}

function between(start: Date, end: Date, now: Date): TimeProgress {
  const total = end.getTime() - start.getTime();
  const elapsed = Math.min(total, Math.max(0, now.getTime() - start.getTime()));
  return { fraction: elapsed / total, remainingMs: total - elapsed };
}

/** Progress through the local calendar day. */
export function dayProgress(now: Date): TimeProgress {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return between(start, end, now);
}

/** Progress through the local calendar year. */
export function yearProgress(now: Date): TimeProgress {
  return between(new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear() + 1, 0, 1), now);
}

/**
 * How full each month of the year is, January first: 1 for months gone by,
 * a fraction for the current one, 0 for those still to come.
 */
export function monthFractions(now: Date): number[] {
  return Array.from({ length: 12 }, (_, month) => {
    const start = new Date(now.getFullYear(), month, 1);
    const end = new Date(now.getFullYear(), month + 1, 1);
    return between(start, end, now).fraction;
  });
}

/** Whole days left in the year, not counting today. */
export function daysLeftInYear(now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = new Date(now.getFullYear(), 11, 31);
  return Math.round((lastDay.getTime() - today.getTime()) / 86_400_000);
}
