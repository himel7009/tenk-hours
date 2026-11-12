import { formatDuration } from '../../domain/format';
import styles from './TodayGoal.module.css';

interface TodayGoalProps {
  minutesToday: number;
  goalMinutes: number;
}

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Today's time against the daily goal that keeps the streak going. */
export function TodayGoal({ minutesToday, goalMinutes }: TodayGoalProps) {
  const fraction = Math.min(1, minutesToday / goalMinutes);
  const reached = minutesToday >= goalMinutes;

  return (
    <div className={styles.goal}>
      <svg viewBox="0 0 48 48" className={styles.ring} aria-hidden="true">
        <circle cx="24" cy="24" r={RADIUS} className={styles.track} />
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          className={styles.fill}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
        />
        {reached && <path d="M17 24.5l5 5 9.5-10.5" className={styles.check} />}
      </svg>
      <p className="tabular">
        <strong>
          {formatDuration(minutesToday)} of {formatDuration(goalMinutes)} today
        </strong>
        <span className={styles.hint}>
          {reached
            ? 'Daily goal reached. Today counts towards your streak.'
            : `${formatDuration(goalMinutes - minutesToday)} more for today to count towards your streak.`}
        </span>
      </p>
    </div>
  );
}
