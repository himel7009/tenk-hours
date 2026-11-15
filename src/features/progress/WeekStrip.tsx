import { addDays, fromDayKey, type DayKey } from '../../domain/dates';
import styles from './WeekStrip.module.css';

interface WeekStripProps {
  /** Days that count towards the streak. */
  completedDays: ReadonlySet<DayKey>;
  /** Days with any time logged. A Set or a Map keyed by day both work. */
  activeDays: { has(day: DayKey): boolean };
  today: DayKey;
}

/** The last seven days: goal reached, some time logged, or nothing. */
export function WeekStrip({ completedDays, activeDays, today }: WeekStripProps) {
  const week = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));

  return (
    <ol className={styles.strip} aria-label="Last 7 days">
      {week.map((day) => {
        const state = completedDays.has(day) ? 'done' : activeDays.has(day) ? 'partial' : 'none';
        const weekday = fromDayKey(day).toLocaleDateString(undefined, { weekday: 'short' });
        return (
          <li key={day} className={styles.day} data-state={state}>
            <span className="visually-hidden">
              {weekday}:{' '}
              {state === 'done' ? 'goal reached' : state === 'partial' ? 'below goal' : 'nothing'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
