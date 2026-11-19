import { describeRoutine, toggleWeekday, WEEKDAYS, type Weekday } from '../domain/routine';
import styles from './WeekdayPicker.module.css';

interface WeekdayPickerProps {
  legend: string;
  hint?: string;
  value: readonly Weekday[];
  onChange: (days: Weekday[]) => void;
}

const dayName = (day: Weekday, style: 'short' | 'long') =>
  // 2023-01-01 was a Sunday.
  new Date(2023, 0, 1 + day).toLocaleDateString(undefined, { weekday: style });

/** Seven day chips. All on, stored as an empty list, means every day. */
export function WeekdayPicker({ legend, hint, value, onChange }: WeekdayPickerProps) {
  const on = (day: Weekday) => value.length === 0 || value.includes(day);
  const onlyOne = value.length === 1;
  return (
    <fieldset className={styles.picker}>
      <legend>{legend}</legend>
      <div className={styles.days}>
        {WEEKDAYS.map((day) => (
          <label key={day} className={styles.day} title={dayName(day, 'long')}>
            <input
              type="checkbox"
              className="visually-hidden"
              checked={on(day)}
              // At least one day stays on; turning all off would mean nothing.
              disabled={onlyOne && on(day)}
              onChange={() => onChange(toggleWeekday(value, day))}
            />
            <span aria-hidden="true">{dayName(day, 'short').slice(0, 2)}</span>
            <span className="visually-hidden">{dayName(day, 'long')}</span>
          </label>
        ))}
      </div>
      <p className={styles.hint}>
        {describeRoutine(value)}
        {hint && `. ${hint}`}
      </p>
    </fieldset>
  );
}
