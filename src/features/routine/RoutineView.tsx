import { useMemo } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { formatDuration } from '../../domain/format';
import { buildRoutineView, weekdayOf, type RoutineViewGroup } from '../../domain/routine';
import { hasDailyGoal } from '../../domain/types';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from '../progress/useNow';
import styles from './routine.module.css';

const dayName = (weekday: number) =>
  // 2023-01-01 was a Sunday.
  new Date(2023, 0, 1 + weekday).toLocaleDateString(undefined, { weekday: 'long' });

function Groups({ groups }: { groups: RoutineViewGroup[] }) {
  return (
    <>
      {groups.map((group) => (
        <div
          key={group.domain?.id ?? 'own'}
          className={styles.viewGroup}
          data-color={group.domain?.color}
        >
          {group.domain ? (
            <p className={styles.viewDomain}>
              <span aria-hidden="true">{group.domain.icon}</span> {group.domain.name}
            </p>
          ) : (
            // Labelled only beside domains, so it is not read as part of the last one.
            groups.length > 1 && <p className={styles.viewOwn}>Not in a domain</p>
          )}
          <ul className={styles.viewItems}>
            {group.items.map((item) => (
              <li key={item.id} data-color={item.color}>
                <span aria-hidden="true">{item.icon}</span>
                <span className={styles.viewName}>{item.name}</span>
                {item.goalMinutes !== null && (
                  <span className={`tabular ${styles.viewGoal}`}>
                    {formatDuration(item.goalMinutes)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** The weekly routine to read: what each day holds, today picked out. */
export function RoutineView({ onClose, onEdit }: { onClose: () => void; onEdit: () => void }) {
  const domains = useTrackerStore((state) => state.domains);
  const skills = useTrackerStore((state) => state.skills);
  const today = useToday();
  const view = useMemo(
    () =>
      buildRoutineView(
        domains,
        skills.map((skill) => ({
          ...skill,
          goalMinutes: hasDailyGoal(skill) ? skill.dailyGoalMinutes : null,
        })),
      ),
    [domains, skills],
  );
  const todayWeekday = weekdayOf(today);

  return (
    <Dialog title="Your routine" onClose={onClose} size="wide">
      {view.everyDay.length > 0 && (
        <section className={styles.viewEvery} aria-labelledby="every-day">
          <h3 id="every-day" className={styles.viewHeading}>
            Every day
          </h3>
          <Groups groups={view.everyDay} />
        </section>
      )}
      <ol className={styles.viewWeek}>
        {view.days.map(({ weekday, groups, goalMinutes }) => (
          <li key={weekday} className={styles.viewDay} data-today={weekday === todayWeekday}>
            <h3 className={styles.viewHeading}>
              {dayName(weekday)}
              {weekday === todayWeekday && <span className={styles.viewToday}>Today</span>}
            </h3>
            <p className={`tabular ${styles.viewTotal}`}>
              {goalMinutes > 0 ? `${formatDuration(goalMinutes)} of goals` : 'No daily goals'}
            </p>
            <div
              className={styles.viewBody}
              // Scrollable, so it can be scrolled from the keyboard too.
              tabIndex={0}
              aria-label={`${dayName(weekday)}'s plan`}
            >
              {groups.length > 0 ? (
                <Groups groups={groups} />
              ) : (
                <p className={styles.viewEmpty}>
                  {view.everyDay.length > 0 ? 'Only the every-day ones.' : 'Nothing planned.'}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className={styles.dialogActions}>
        <Button variant="quiet" onClick={onEdit}>
          Edit routine
        </Button>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
