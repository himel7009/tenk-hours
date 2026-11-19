import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { buildWeekPlan, weekdayOf } from '../../domain/routine';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from '../progress/useNow';
import styles from './routine.module.css';
import { RoutineDialog } from './RoutineDialog';

const dayName = (weekday: number, style: 'narrow' | 'long') =>
  // 2023-01-01 was a Sunday.
  new Date(2023, 0, 1 + weekday).toLocaleDateString(undefined, { weekday: style });

/** The week at a glance: what is planned for each day, today picked out. */
export function RoutineCard() {
  const domains = useTrackerStore((state) => state.domains);
  const skills = useTrackerStore((state) => state.skills);
  const today = useToday();
  const [editing, setEditing] = useState(false);
  const plan = useMemo(() => buildWeekPlan(domains, skills), [domains, skills]);
  const todayWeekday = weekdayOf(today);
  const todayEntries = plan.days[todayWeekday]?.entries ?? [];
  const planned = plan.days.some((day) => day.entries.length > 0);

  return (
    <section className={`${styles.card}`} aria-labelledby="routine-title">
      <div className={styles.head}>
        <h2 id="routine-title" className={styles.title}>
          Your week
        </h2>
        <Button size="sm" variant="quiet" onClick={() => setEditing(true)}>
          {planned ? 'Edit routine' : 'Plan your week'}
        </Button>
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
                  entries.map((entry) => entry.name).join(', ') || 'nothing planned'
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
                      title={entry.name}
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
          </p>
        </>
      ) : (
        <p className={styles.empty}>
          Studying everything every day spreads you thin. Pick the days for each domain, say AI on
          Sunday and maths on Monday. Days off never break a streak.
        </p>
      )}

      {editing && <RoutineDialog onClose={() => setEditing(false)} />}
    </section>
  );
}
