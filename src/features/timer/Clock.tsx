import { formatClock } from '../../domain/format';
import { useNow } from '../progress/useNow';

interface ClockProps {
  startedAt: number;
  className?: string;
}

/** Ticking elapsed time. Isolated so only this node re-renders each second. */
export function Clock({ startedAt, className }: ClockProps) {
  const now = useNow(1000);
  return (
    <span className={`tabular ${className ?? ''}`} role="timer">
      {formatClock(now - startedAt)}
    </span>
  );
}
