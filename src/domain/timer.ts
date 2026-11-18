import type { ActiveTimer } from './types';

/**
 * Time actually spent on the session: from the start to now, or to the
 * moment it was paused, minus every earlier pause. A countdown never counts
 * more than its planned length.
 */
export function elapsedMs(timer: ActiveTimer, now: number): number {
  const until = timer.pausedAt ?? now;
  const elapsed = Math.max(0, until - timer.startedAt - timer.pausedMs);
  return timer.durationSeconds === null ? elapsed : Math.min(elapsed, timer.durationSeconds * 1000);
}

/** Time left on a countdown. Infinity for an open-ended stopwatch. */
export function remainingMs(timer: ActiveTimer, now: number): number {
  return timer.durationSeconds === null
    ? Infinity
    : timer.durationSeconds * 1000 - elapsedMs(timer, now);
}

/**
 * When a countdown will run out if left alone. Infinity for a stopwatch or a
 * paused timer, since neither will end by itself.
 */
export function timerEndsAt(timer: ActiveTimer): number {
  if (timer.durationSeconds === null || timer.pausedAt !== null) return Infinity;
  return timer.startedAt + timer.pausedMs + timer.durationSeconds * 1000;
}

/** What the clock shows: time left on a countdown, time spent otherwise. */
export function clockMs(timer: ActiveTimer, now: number): number {
  return timer.durationSeconds === null ? elapsedMs(timer, now) : remainingMs(timer, now);
}

export function pause(timer: ActiveTimer, now: number): ActiveTimer {
  return timer.pausedAt === null ? { ...timer, pausedAt: now } : timer;
}

export function resume(timer: ActiveTimer, now: number): ActiveTimer {
  if (timer.pausedAt === null) return timer;
  return { ...timer, pausedAt: null, pausedMs: timer.pausedMs + (now - timer.pausedAt) };
}
