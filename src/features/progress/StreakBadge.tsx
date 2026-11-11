import type { Streak } from '../../domain/streaks';
import styles from './StreakBadge.module.css';

interface StreakBadgeProps {
  streak: Streak;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  const { current, loggedToday } = streak;
  if (current === 0) return <span className={styles.none}>No streak yet</span>;

  return (
    <span
      className={styles.badge}
      data-pending={!loggedToday}
      title={loggedToday ? undefined : 'Log time today to keep this streak'}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M8.3 0.8c0.4 2.4-0.6 3.6-1.7 4.8C5.3 7 4 8.3 4 10.5a4 4 0 0 0 8 0c0-1.3-0.5-2.3-1.1-3.2-0.3 0.9-0.8 1.4-1.5 1.7C9.900 6.100 9.800 2.900 8.300 0.800Z" />
      </svg>
      {current} day{current === 1 ? '' : 's'}
    </span>
  );
}
