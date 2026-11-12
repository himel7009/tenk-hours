import { formatClock } from '../../domain/format';
import type { ActiveTimer } from '../../domain/types';
import { useNow } from '../progress/useNow';
import { clockMs } from './clockMs';

interface ClockProps {
  timer: ActiveTimer;
  className?: string;
}

/** Ticking clock. Isolated so only this node re-renders each second. */
export function Clock({ timer, className }: ClockProps) {
  const now = useNow(1000);
  return (
    <span className={`tabular ${className ?? ''}`} role="timer">
      {formatClock(clockMs(timer, now))}
    </span>
  );
}
