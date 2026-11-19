import { formatClock } from '../../domain/format';
import { displayClockMs } from '../../domain/pomodoro';
import type { ActiveTimer } from '../../domain/types';
import { useNow } from '../progress/useNow';

interface ClockProps {
  timer: ActiveTimer;
  className?: string;
}

/** Ticking clock. Isolated so only this node re-renders each second. */
export function Clock({ timer, className }: ClockProps) {
  const now = useNow(1000);
  const phase = timer.pomodoro?.phase ?? 'focus';
  return (
    <span
      className={`tabular ${className ?? ''}`}
      role="timer"
      data-paused={phase === 'focus' && timer.pausedAt !== null}
      data-phase={phase}
    >
      {formatClock(displayClockMs(timer, now))}
    </span>
  );
}
