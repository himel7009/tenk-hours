import { Button } from '../../components/Button';
import { addDays, type DayKey } from '../../domain/dates';
import styles from './TodoList.module.css';

/**
 * An optional deadline. Off by default ("No deadline"); turning it on starts
 * a week after `from`, and it can be turned off again.
 */
export function DeadlinePicker({
  value,
  onChange,
  from,
  id,
}: {
  value: DayKey | null;
  onChange: (deadline: DayKey | null) => void;
  /** The earliest it can be: the day the to-do is planned for. */
  from: DayKey;
  id?: string;
}) {
  if (value === null) {
    return (
      <Button
        id={id}
        size="sm"
        variant="quiet"
        className={styles.deadlineOff}
        aria-label="No deadline. Add a deadline"
        onClick={() => onChange(addDays(from, 7))}
      >
        No deadline
      </Button>
    );
  }
  return (
    <span className={styles.deadlineOn}>
      <label className={styles.place}>
        <span className={styles.deadlineLabel}>Due</span>
        <input
          id={id}
          type="date"
          aria-label="Deadline"
          value={value}
          min={from}
          onChange={(event) => event.target.value && onChange(event.target.value)}
        />
      </label>
      <Button
        size="sm"
        variant="quiet"
        aria-label="Remove the deadline"
        onClick={() => onChange(null)}
      >
        ✕
      </Button>
    </span>
  );
}
