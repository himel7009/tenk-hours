import { formatDuration } from '../../domain/format';
import {
  dayProgress,
  daysLeftInYear,
  monthFractions,
  yearProgress,
} from '../../domain/timeProgress';
import { useNow } from '../progress/useNow';
import styles from './dashboard.module.css';

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MONTH_INITIALS = Array.from({ length: 12 }, (_, month) =>
  new Date(2026, month, 1).toLocaleDateString(undefined, { month: 'narrow' }),
);

const percent = (fraction: number, digits: number) =>
  `${(fraction * 100).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;

/** How much of today has gone, as a ring that fills like a clock face. */
export function DayCard() {
  const now = new Date(useNow(30_000));
  const { fraction, remainingMs } = dayProgress(now);

  return (
    <section className={`${styles.card} ${styles.timeCard}`} aria-label="Today">
      <svg viewBox="0 0 100 100" className={styles.ring} aria-hidden="true">
        <circle cx="50" cy="50" r={RADIUS} className={styles.ringTrack} />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          className={styles.ringFill}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
        />
        <text x="50" y="50" className={styles.ringLabel}>
          {percent(fraction, 0)}
        </text>
      </svg>
      <div>
        <h2 className={styles.cardTitle}>Today</h2>
        <p className={`tabular ${styles.cardFigure}`}>
          {formatDuration(Math.floor(remainingMs / 60_000))} left
        </p>
        <p className={`tabular ${styles.cardNote}`}>
          {percent(fraction, 0)} of the day has passed, {percent(1 - fraction, 0)} is still ahead.
        </p>
      </div>
    </section>
  );
}

/** How much of the year has gone, one block per month. */
export function YearCard() {
  const now = new Date(useNow(30_000));
  const { fraction } = yearProgress(now);
  const daysLeft = daysLeftInYear(now);

  return (
    <section className={`${styles.card} ${styles.yearCard}`} aria-label={`${now.getFullYear()}`}>
      <div className={styles.yearHead}>
        <h2 className={styles.cardTitle}>{now.getFullYear()}</h2>
        <p className={`tabular ${styles.cardFigure}`}>{percent(fraction, 1)} passed</p>
      </div>
      <ol className={styles.months} aria-hidden="true">
        {monthFractions(now).map((filled, month) => (
          <li key={month} className={styles.month}>
            <span className={styles.monthBar}>
              <span className={styles.monthFill} style={{ height: `${filled * 100}%` }} />
            </span>
            {MONTH_INITIALS[month]}
          </li>
        ))}
      </ol>
      <p className={`tabular ${styles.cardNote}`}>
        {percent(1 - fraction, 1)} left: {daysLeft} day{daysLeft === 1 ? '' : 's'} after today.
      </p>
    </section>
  );
}
