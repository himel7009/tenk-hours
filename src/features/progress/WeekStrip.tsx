import { addDays, fromDayKey, type DayKey } from '../../domain/dates';
import type { Progress } from '../../domain/progress';
import styles from './WeekStrip.module.css';

interface WeekStripProps {
  progress: Progress;
  today: DayKey;
}

/** The last seven days: goal reached, some time logged, or nothing. */
export function WeekStrip({ progress, today }: WeekStripProps) {
  const week = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));

  return (
    <ol className={styles.strip} aria-label="Last 7 days">
      {week.map((day) => {
        const state = progress.completedDays.has(day)
          ? 'done'
          : progress.byDay.has(day)
            ? 'partial'
            : 'none';
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
