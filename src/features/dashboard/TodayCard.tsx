import { fromDayKey, type DayKey } from '../../domain/dates';
import type { Dashboard } from '../../domain/dashboard';
import { formatDuration, formatHours } from '../../domain/format';
import { hasDailyGoal } from '../../domain/types';
import styles from './dashboard.module.css';

const MAX_LISTED = 5;

interface TodayCardProps {
  dashboard: Dashboard;
  today: DayKey;
}

/** The headline card: time put in today and which daily goals are done. */
export function TodayCard({ dashboard, today }: TodayCardProps) {
  const { trackers, minutesToday, totalMinutes, bestStreak } = dashboard;
  // Today's goals are the ones on today's routine, plus any met on a day off.
  const withGoals = trackers.filter(
    ({ skill, progress }) =>
      hasDailyGoal(skill) && (progress.plannedToday || progress.goalMetToday),
  );
  const reached = withGoals.filter(({ progress }) => progress.goalMetToday).length;
  // Whatever has time today comes first, then what is planned; the card has
  // room for a handful.
  // A day off with no time put in has nothing to say today.
  const relevant = trackers.filter(
    ({ progress }) => progress.plannedToday || progress.minutesToday > 0,
  );
  const shown = [...relevant]
    .sort(
      (a, b) =>
        b.progress.minutesToday - a.progress.minutesToday ||
        Number(b.progress.plannedToday) - Number(a.progress.plannedToday),
    )
    .slice(0, MAX_LISTED);

  return (
    <section className={`${styles.card} ${styles.todayCard}`}>
      <p className={styles.date}>
        {fromDayKey(today).toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
      </p>
      <h1 className={styles.headline}>
        {minutesToday > 0 ? `${formatDuration(minutesToday)} today` : 'Nothing logged yet today'}
      </h1>

      {withGoals.length > 0 && (
        <div className={styles.goals}>
          <ol className={styles.goalPills} aria-hidden="true">
            {withGoals.map(({ skill, progress }) => (
              <li
                key={skill.id}
                className={styles.goalPill}
                data-color={skill.color}
                data-done={progress.goalMetToday}
                title={`${skill.name}: ${formatDuration(progress.minutesToday)} of ${formatDuration(skill.dailyGoalMinutes)}`}
              />
            ))}
          </ol>
          <p className={`tabular ${styles.cardNote}`}>
            {reached} of {withGoals.length} daily goal{withGoals.length === 1 ? '' : 's'} reached
          </p>
        </div>
      )}

      <ul className={styles.todayList}>
        {shown.map(({ skill, progress }) => (
          <li key={skill.id} data-color={skill.color}>
            <span aria-hidden="true">{skill.icon}</span>
            <span className={styles.todayName}>{skill.name}</span>
            {!progress.plannedToday && progress.minutesToday === 0 ? (
              <>
                <span className={styles.todayNoGoal}>day off</span>
                <span className="tabular">0m</span>
              </>
            ) : hasDailyGoal(skill) ? (
              <>
                <span className={styles.todayBar} aria-hidden="true">
                  <span
                    style={{
                      width: `${Math.min(1, progress.minutesToday / skill.dailyGoalMinutes) * 100}%`,
                    }}
                  />
                </span>
                <span className="tabular">
                  {formatDuration(progress.minutesToday)} / {formatDuration(skill.dailyGoalMinutes)}
                </span>
              </>
            ) : (
              <>
                <span className={styles.todayNoGoal}>project</span>
                <span className="tabular">{formatDuration(progress.minutesToday)}</span>
              </>
            )}
          </li>
        ))}
        {relevant.length > shown.length && (
          <li className={styles.todayMore}>and {relevant.length - shown.length} more below</li>
        )}
        {trackers.length > relevant.length && (
          <li className={styles.todayMore}>
            {trackers.length - relevant.length} on a day off today
          </li>
        )}
      </ul>

      <dl className={styles.totals}>
        <div>
          <dt>All time</dt>
          <dd className="tabular">{formatHours(totalMinutes)} hours</dd>
        </div>
        <div>
          <dt>Best running streak</dt>
          <dd className="tabular">
            {bestStreak
              ? `${bestStreak.days} day${bestStreak.days === 1 ? '' : 's'}, ${bestStreak.skill.name}`
              : 'None yet'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
