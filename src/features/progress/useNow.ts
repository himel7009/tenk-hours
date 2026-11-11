import { useEffect, useState } from 'react';
import { todayKey, type DayKey } from '../../domain/dates';

/** The current time, refreshed on an interval. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);

  return now;
}

/** Today's day key. Rolls over at midnight while the app stays open. */
export function useToday(): DayKey {
  return todayKey(new Date(useNow(60_000)));
}
