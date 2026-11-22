import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { addDays, type DayKey } from '../../domain/dates';
import { buildDayPlan, type DayPlanRow } from '../../domain/routine';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from '../progress/useNow';
import styles from './routine.module.css';

const KIND: Record<DayPlanRow['kind'], string> = {
  domain: 'Domain',
  skill: 'Skill',
  habit: 'Habit',
  project: 'Project',
};

function dayLabel(day: DayKey, today: DayKey): string {
  if (day === today) return 'today';
  if (day === addDays(today, 1)) return 'tomorrow';
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Changes one day without touching the weekly routine: add a domain or
 * tracker to the day, or skip one. Skipping never breaks a streak, and what
 * is added is a bonus that cannot break one either.
 */
export function ChangeDayDialog({
  day: initialDay,
  onClose,
}: {
  day?: DayKey;
  onClose: () => void;
}) {
  const today = useToday();
  const domains = useTrackerStore((state) => state.domains);
  const skills = useTrackerStore((state) => state.skills);
  const changeDayPlan = useTrackerStore((state) => state.changeDayPlan);
  const [day, setDay] = useState<DayKey>(initialDay ?? today);
  const plan = useMemo(() => buildDayPlan(domains, skills, day), [domains, skills, day]);
  const label = dayLabel(day, today);

  const row = (item: DayPlanRow) => {
    const action =
      item.state === 'routine'
        ? { text: 'Skip', change: 'skip' as const, hint: `Skip ${item.name} ${label}` }
        : item.state === 'added'
          ? { text: 'Remove', change: 'reset' as const, hint: `Remove ${item.name} from ${label}` }
          : item.state === 'skipped'
            ? {
                text: 'Bring back',
                change: 'reset' as const,
                hint: `Bring back ${item.name} ${label}`,
              }
            : { text: 'Add', change: 'add' as const, hint: `Add ${item.name} to ${label}` };
    return (
      <li key={item.id} className={styles.planRow} data-color={item.color} data-state={item.state}>
        <span className={styles.planIcon} aria-hidden="true">
          {item.icon}
        </span>
        <span className={styles.planText}>
          <span className={styles.planName}>
            {item.name} <span className={styles.planKind}>{KIND[item.kind]}</span>
          </span>
          {(item.inside.length > 0 || item.state === 'added' || item.state === 'skipped') && (
            <span className={styles.planNote}>
              {item.state === 'added' && 'Added for this day. '}
              {item.state === 'skipped' && 'Skipped this day; its streak is safe. '}
              {item.inside.length > 0 && `With ${item.inside.join(', ')}.`}
            </span>
          )}
        </span>
        <Button
          size="sm"
          variant={action.change === 'add' ? 'secondary' : 'quiet'}
          aria-label={action.hint}
          onClick={() => changeDayPlan(item.target, day, action.change)}
        >
          {action.text}
        </Button>
      </li>
    );
  };

  return (
    <Dialog title="Change a day" onClose={onClose}>
      <div className={styles.changeDay}>
        <p className={styles.planIntro}>
          Do something else for one day without changing your routine. Added work is a bonus:
          reaching its goal counts, missing it costs nothing. A skipped day never breaks a streak.
        </p>
        <div className={styles.dayPick} role="group" aria-label="Day to change">
          <Button
            size="sm"
            variant={day === today ? 'primary' : 'secondary'}
            onClick={() => setDay(today)}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant={day === addDays(today, 1) ? 'primary' : 'secondary'}
            onClick={() => setDay(addDays(today, 1))}
          >
            Tomorrow
          </Button>
          <input
            type="date"
            className={styles.dateInput}
            aria-label="Another day"
            value={day}
            min={today}
            onChange={(event) => event.target.value && setDay(event.target.value)}
          />
        </div>

        <section aria-labelledby="day-on">
          <h3 id="day-on" className={styles.planHeading}>
            On the plan {label}
          </h3>
          {plan.on.length > 0 ? (
            <ul className={styles.planList}>{plan.on.map(row)}</ul>
          ) : (
            <p className={styles.planEmpty}>Nothing yet. Add something from below.</p>
          )}
        </section>

        {plan.off.length > 0 && (
          <section aria-labelledby="day-off">
            <h3 id="day-off" className={styles.planHeading}>
              Not on the plan {label}
            </h3>
            <ul className={styles.planList}>{plan.off.map(row)}</ul>
          </section>
        )}

        <div className={styles.planDone}>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
