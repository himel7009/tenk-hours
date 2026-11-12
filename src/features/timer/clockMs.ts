import type { ActiveTimer } from '../../domain/types';
import { timerEndsAt } from '../../store/trackerStore';

/** What the clock shows: time left on a countdown, time elapsed otherwise. */
export function clockMs(timer: ActiveTimer, now: number): number {
  return timer.durationMinutes === null
    ? now - timer.startedAt
    : Math.max(0, timerEndsAt(timer) - now);
}
