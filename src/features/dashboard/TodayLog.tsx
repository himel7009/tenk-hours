import { Link } from 'react-router';
import { formatDuration } from '../../domain/format';
import { useTodayLog } from '../progress/useDayLog';
import styles from './TodayLog.module.css';

const timeOf = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** What you worked on today, from each session's note. Newest first. */
export function TodayLog() {
  const { entries, totalMinutes } = useTodayLog();
  return (
    <section className={styles.card} aria-labelledby="today-log-title">
      <div className={styles.head}>
        <h2 id="today-log-title" className={styles.title}>
          Today's log
        </h2>
        {entries.length > 0 && (
          <p className={`tabular ${styles.total}`}>
            {formatDuration(totalMinutes)} in {entries.length}{' '}
            {entries.length === 1 ? 'session' : 'sessions'}
          </p>
        )}
      </div>
      {entries.length === 0 ? (
        <p className={styles.empty}>
          Nothing logged yet today. Start a timer and say what you are working on; it shows here.
        </p>
      ) : (
        <ol className={styles.list} tabIndex={0} aria-label="Today's sessions">
          {entries.map(({ session, skill }) => (
            <li key={session.id} className={styles.row} data-color={skill.color}>
              <span className={`tabular ${styles.time}`}>{timeOf(session.createdAt)}</span>
              <span className={styles.what}>
                <span className={styles.note}>
                  {session.note || (session.source === 'timer' ? 'Timed session' : 'Logged time')}
                </span>
                <Link to={`/skills/${skill.id}`} className={styles.skill}>
                  <span aria-hidden="true">{skill.icon}</span> {skill.name}
                </Link>
              </span>
              <span className={`tabular ${styles.minutes}`}>{formatDuration(session.minutes)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
