import { formatClock } from '../../domain/format';
import { clockMs } from '../../domain/timer';
import type { ActiveTimer } from '../../domain/types';
import { useNow } from '../progress/useNow';

interface ClockProps {
  timer: ActiveTimer;
  className?: string;
}

/** Ticking clock. Isolated so only this node re-renders each second. */
export function Clock({ timer, className }: ClockProps) {
  const now = useNow(1000);
  return (
    <span
      className={`tabular ${className ?? ''}`}
      role="timer"
      data-paused={timer.pausedAt !== null}
    >
      {formatClock(clockMs(timer, now))}
    </span>
  );
}
