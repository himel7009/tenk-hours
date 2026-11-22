import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { addDays } from '../../domain/dates';
import { buildWeekPlan, weekdayOf } from '../../domain/routine';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from '../progress/useNow';
import styles from './routine.module.css';
import { ChangeDayDialog } from './ChangeDayDialog';
import { RoutineDialog } from './RoutineDialog';
import { RoutineView } from './RoutineView';

const dayName = (weekday: number, style: 'narrow' | 'long') =>
  // 2023-01-01 was a Sunday.
  new Date(2023, 0, 1 + weekday).toLocaleDateString(undefined, { weekday: style });

/** The week at a glance: what is planned for each day, today picked out. */
export function RoutineCard() {
  const domains = useTrackerStore((state) => state.domains);
  const skills = useTrackerStore((state) => state.skills);
  const today = useToday();
  const [editing, setEditing] = useState(false);
  const [changing, setChanging] = useState(false);
  const [viewing, setViewing] = useState(false);
  const todayWeekday = weekdayOf(today);
  // This week's real dates, Sunday first, so one-day changes show.
  const plan = useMemo(() => {
    const sunday = addDays(today, -todayWeekday);
    const week = [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(sunday, offset));
    return buildWeekPlan(domains, skills, week);
  }, [domains, skills, today, todayWeekday]);
  const todayAll = plan.days[todayWeekday]?.entries ?? [];
  const todayEntries = todayAll.filter((entry) => entry.change !== 'skipped');
  const todaySkipped = todayAll.filter((entry) => entry.change === 'skipped');
  const planned = plan.days.some((day) => day.entries.length > 0);

  return (
    <section className={`${styles.card}`} aria-labelledby="routine-title">
      <div className={styles.head}>
        <h2 id="routine-title" className={styles.title}>
          Your week
        </h2>
        <div className={styles.headActions}>
          {skills.length > 0 && (
            <Button
              size="sm"
              variant="quiet"
              aria-label="View routine"
              onClick={() => setViewing(true)}
            >
              View
            </Button>
          )}
          {planned && (
            <Button size="sm" variant="quiet" onClick={() => setChanging(true)}>
              Change a day
            </Button>
          )}
          <Button
            size="sm"
            variant="quiet"
            aria-label={planned ? 'Edit routine' : undefined}
            onClick={() => setEditing(true)}
          >
            {planned ? 'Edit' : 'Plan your week'}
          </Button>
        </div>
      </div>

      {planned ? (
        <>
          <ol className={styles.week}>
            {plan.days.map(({ weekday, entries }) => (
              <li
                key={weekday}
                className={styles.day}
                data-today={weekday === todayWeekday}
                aria-label={`${dayName(weekday, 'long')}: ${
                  entries
                    .map((entry) =>
                      entry.change ? `${entry.name} (${entry.change} this week)` : entry.name,
                    )
                    .join(', ') || 'nothing planned'
                }`}
              >
                <span className={styles.dayName} aria-hidden="true">
                  {dayName(weekday, 'narrow')}
                </span>
                <span className={styles.stack} aria-hidden="true">
                  {entries.map((entry) => (
                    <span
                      key={entry.id}
                      className={styles.chip}
                      data-color={entry.color}
                      data-type={entry.type}
                      data-change={entry.change}
                      title={entry.change ? `${entry.name}, ${entry.change} this week` : entry.name}
                    >
                      {entry.icon}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
          <p className={styles.todayLine}>
            {todayEntries.length > 0 ? (
              <>
                Today: <strong>{todayEntries.map((entry) => entry.name).join(', ')}</strong>
              </>
            ) : (
              'Nothing on the routine today.'
            )}
            {plan.everyDay > 0 && ` Plus ${plan.everyDay} you do every day.`}
            {todaySkipped.length > 0 &&
              ` Skipped today: ${todaySkipped.map((entry) => entry.name).join(', ')}.`}
          </p>
        </>
      ) : (
        <p className={styles.empty}>
          Studying everything every day spreads you thin. Pick the days for each domain, say AI on
          Sunday and maths on Monday. Days off never break a streak.
        </p>
      )}

      {editing && <RoutineDialog onClose={() => setEditing(false)} />}
      {changing && <ChangeDayDialog onClose={() => setChanging(false)} />}
      {viewing && (
        <RoutineView
          onClose={() => setViewing(false)}
          onEdit={() => {
            setViewing(false);
            setEditing(true);
          }}
        />
      )}
    </section>
  );
}
