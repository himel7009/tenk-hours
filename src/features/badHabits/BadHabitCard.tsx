import { useState } from 'react';
import { Button } from '../../components/Button';
import type { BadHabit, CheckInStatus } from '../../domain/badHabits';
import { addDays, fromDayKey, type DayKey } from '../../domain/dates';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import cardStyles from '../skills/SkillCard.module.css';
import { useToday } from '../progress/useNow';
import styles from './BadHabitCard.module.css';
import { BadHabitFormDialog } from './BadHabitFormDialog';
import { useBadHabitProgress } from './useBadHabitProgress';

/** Clicking a past day steps through no answer, clean and slipped. */
const NEXT_STATUS: Record<'none' | CheckInStatus, CheckInStatus | null> = {
  none: 'clean',
  clean: 'slipped',
  slipped: null,
};

const STATUS_WORDS: Record<'none' | CheckInStatus, string> = {
  none: 'no answer',
  clean: 'stayed clean',
  slipped: 'slipped',
};

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

interface BadHabitCardProps {
  habit: BadHabit;
}

export function BadHabitCard({ habit }: BadHabitCardProps) {
  const today = useToday();
  const progress = useBadHabitProgress(habit.id);
  const setCheckIn = useTrackerStore((state) => state.setCheckIn);
  const deleteBadHabit = useTrackerStore((state) => state.deleteBadHabit);
  const toast = useToastStore((state) => state.show);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { todayStatus, currentStreak, longestStreak, cleanRate30 } = progress;
  const week = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));

  const answer = (status: CheckInStatus) => {
    setCheckIn(habit.id, today, status);
    toast(
      status === 'clean' ? `Clean day logged for ${habit.name}` : 'Logged. Tomorrow is a new day.',
    );
  };

  const cycle = (day: DayKey) => {
    const current = progress.byDay.get(day) ?? 'none';
    setCheckIn(habit.id, day, NEXT_STATUS[current]);
  };

  return (
    <li className={`${cardStyles.card} ${styles.card}`} data-color={habit.color}>
      <div className={styles.head}>
        <span className={cardStyles.icon} aria-hidden="true">
          {habit.icon}
        </span>
        <div className={styles.heading}>
          <h3 className={cardStyles.name}>{habit.name}</h3>
          <p className={`tabular ${styles.streak}`}>
            {currentStreak > 0 ? (
              <>
                <strong>{days(currentStreak)}</strong> clean
              </>
            ) : (
              'No clean streak yet'
            )}
          </p>
        </div>
      </div>

      <div className={cardStyles.shortcuts}>
        <button
          type="button"
          className={cardStyles.shortcut}
          onClick={() => setEditing(true)}
          aria-label={`Edit ${habit.name}`}
          title="Edit bad habit"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M11.3 1.9a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1l-8 8-3.3.8.8-3.3 7.7-8.3Z" />
          </svg>
        </button>
        <button
          type="button"
          className={`${cardStyles.shortcut} ${cardStyles.shortcutDanger}`}
          onClick={() => setConfirmingDelete(true)}
          aria-label={`Delete ${habit.name}`}
          title="Delete bad habit"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.6 9.5h6.8L12 4M6.7 6.5V11M9.3 6.5V11" />
          </svg>
        </button>
      </div>

      {todayStatus === null ? (
        <div className={styles.question}>
          <p>Did you stay away from it today?</p>
          <div className={styles.answers}>
            <Button size="sm" variant="primary" onClick={() => answer('clean')}>
              Yes, I did
            </Button>
            <Button size="sm" onClick={() => answer('slipped')}>
              No, I slipped
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.answered} data-status={todayStatus}>
          <span>{todayStatus === 'clean' ? 'Clean today' : 'Slipped today'}</span>
          <button
            type="button"
            className={styles.change}
            onClick={() => setCheckIn(habit.id, today, null)}
          >
            Change
          </button>
        </div>
      )}

      <div className={styles.footer}>
        <ol className={styles.week} aria-label="Last 7 days. Select a day to change its answer.">
          {week.map((day) => {
            const status = progress.byDay.get(day) ?? 'none';
            const label = fromDayKey(day).toLocaleDateString(undefined, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            });
            return (
              <li key={day}>
                <button
                  type="button"
                  className={styles.day}
                  data-status={status}
                  data-today={day === today}
                  onClick={() => cycle(day)}
                  aria-label={`${label}: ${STATUS_WORDS[status]}`}
                  title={`${label}: ${STATUS_WORDS[status]}`}
                >
                  {fromDayKey(day).toLocaleDateString(undefined, { weekday: 'narrow' })}
                </button>
              </li>
            );
          })}
        </ol>
        <p className={`tabular ${styles.stats}`}>
          {longestStreak > 0 && <>Longest {days(longestStreak)}</>}
          {cleanRate30 !== null && (
            <>
              {longestStreak > 0 && <br />}
              {Math.round(cleanRate30 * 100)}% clean in 30 days
            </>
          )}
        </p>
      </div>

      {confirmingDelete && (
        <div className={cardStyles.confirm} role="alertdialog" aria-label={`Delete ${habit.name}`}>
          <p>Delete this bad habit and all its answers? This cannot be undone.</p>
          <div className={cardStyles.confirmActions}>
            <Button size="sm" variant="quiet" onClick={() => setConfirmingDelete(false)} autoFocus>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                deleteBadHabit(habit.id);
                toast(`Deleted ${habit.name}`);
              }}
            >
              Delete bad habit
            </Button>
          </div>
        </div>
      )}

      {editing && <BadHabitFormDialog habit={habit} onClose={() => setEditing(false)} />}
    </li>
  );
}
