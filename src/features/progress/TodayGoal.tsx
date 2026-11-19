import { formatDuration } from '../../domain/format';
import styles from './TodayGoal.module.css';

interface TodayGoalProps {
  minutesToday: number;
  goalMinutes: number;
  /** Whether the day counts towards a streak. */
  keepsStreak?: boolean;
  /** Whether today is on the routine. */
  plannedToday?: boolean;
}

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Today's time against the daily goal that keeps the streak going. */
export function TodayGoal({
  minutesToday,
  goalMinutes,
  keepsStreak = true,
  plannedToday = true,
}: TodayGoalProps) {
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
            ? keepsStreak
              ? 'Daily goal reached. Today counts towards your streak.'
              : 'Daily goal reached.'
            : !plannedToday
              ? keepsStreak
                ? 'Day off today, so your streak is safe. Time you put in still counts.'
                : 'Day off today. Time you put in still counts.'
              : keepsStreak
                ? `${formatDuration(goalMinutes - minutesToday)} more for today to count towards your streak.`
                : `${formatDuration(goalMinutes - minutesToday)} more to reach today's goal.`}
        </span>
      </p>
    </div>
  );
}
