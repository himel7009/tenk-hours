import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { toggleWeekday, WEEKDAYS, type Weekday } from '../../domain/routine';
import { useTrackerStore } from '../../store/trackerStore';
import styles from './routine.module.css';

const dayName = (weekday: number, style: 'short' | 'long') =>
  new Date(2023, 0, 1 + weekday).toLocaleDateString(undefined, { weekday: style });

interface Row {
  key: string;
  name: string;
  icon: string;
  color: string;
  note: string;
  days: readonly Weekday[];
  target: { domainId: string } | { skillId: string };
}

/**
 * The whole routine in one grid: a row per domain and per tracker outside a
 * domain, a column per weekday. Changes save as they are made.
 */
export function RoutineDialog({ onClose }: { onClose: () => void }) {
  const domains = useTrackerStore((state) => state.domains);
  const skills = useTrackerStore((state) => state.skills);
  const setRoutine = useTrackerStore((state) => state.setRoutine);

  const rows: Row[] = [
    ...domains.map((domain) => {
      const count = skills.filter((skill) => skill.domainId === domain.id).length;
      return {
        key: domain.id,
        name: domain.name,
        icon: domain.icon,
        color: domain.color,
        note: `Domain, ${count} ${count === 1 ? 'item' : 'items'}`,
        days: domain.routineDays,
        target: { domainId: domain.id },
      };
    }),
    ...skills
      .filter((skill) => skill.domainId === null)
      .map((skill) => ({
        key: skill.id,
        name: skill.name,
        icon: skill.icon,
        color: skill.color,
        note: skill.kind.charAt(0).toUpperCase() + skill.kind.slice(1),
        days: skill.routineDays,
        target: { skillId: skill.id },
      })),
  ];

  return (
    <Dialog title="Plan your week" onClose={onClose}>
      <p className={styles.lede}>
        Pick the days for each one. Skills in a domain follow its days. A day off never breaks a
        streak, and time put in on a day off still counts.
      </p>
      {rows.length === 0 ? (
        <p className={styles.empty}>Add a domain, skill or habit first, then plan its days here.</p>
      ) : (
        <div className={styles.gridWrap}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th scope="col">
                  <span className="visually-hidden">Planned for</span>
                </th>
                {WEEKDAYS.map((weekday) => (
                  <th key={weekday} scope="col" abbr={dayName(weekday, 'long')}>
                    {dayName(weekday, 'short').slice(0, 2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const on = (weekday: Weekday) =>
                  row.days.length === 0 || row.days.includes(weekday);
                return (
                  <tr key={row.key} data-color={row.color}>
                    <th scope="row">
                      <span className={styles.rowName}>
                        <span aria-hidden="true">{row.icon}</span> {row.name}
                      </span>
                      <span className={styles.rowNote}>
                        {row.note}
                        {row.days.length === 0 && ', every day'}
                      </span>
                    </th>
                    {WEEKDAYS.map((weekday) => (
                      <td key={weekday}>
                        <label className={styles.cell}>
                          <input
                            type="checkbox"
                            className="visually-hidden"
                            checked={on(weekday)}
                            // One day stays on: none at all would mean nothing.
                            disabled={row.days.length === 1 && on(weekday)}
                            onChange={() =>
                              setRoutine(row.target, toggleWeekday(row.days, weekday))
                            }
                          />
                          <span className="visually-hidden">
                            {row.name} on {dayName(weekday, 'long')}
                          </span>
                        </label>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className={styles.dialogActions}>
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Dialog>
  );
}
