import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { formatDay, formatDuration } from '../../domain/format';
import type { Session } from '../../domain/types';
import { useToday } from '../progress/useNow';
import { SessionEditDialog } from './SessionEditDialog';
import styles from './sessions.module.css';

const PAGE_SIZE = 30;

interface SessionListProps {
  sessions: readonly Session[];
}

export function SessionList({ sessions }: SessionListProps) {
  const today = useToday();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const newestFirst = useMemo(
    () => [...sessions].sort((a, b) => b.day.localeCompare(a.day) || b.createdAt - a.createdAt),
    [sessions],
  );
  const editing = sessions.find((session) => session.id === editingId);

  if (sessions.length === 0) {
    return (
      <p className={styles.empty}>
        No sessions yet. Start the timer or log time you have already spent.
      </p>
    );
  }

  return (
    <>
      <ul className={styles.list}>
        {newestFirst.slice(0, limit).map((session) => (
          <li key={session.id} className={styles.row}>
            <span className={styles.day}>{formatDay(session.day, today)}</span>
            <span className={`tabular ${styles.duration}`}>{formatDuration(session.minutes)}</span>
            <span className={styles.rowNote}>
              {session.note || (session.source === 'timer' ? 'Timed session' : '')}
            </span>
            <Button
              size="sm"
              variant="quiet"
              onClick={() => setEditingId(session.id)}
              aria-label={`Edit session from ${formatDay(session.day, today)}, ${formatDuration(session.minutes)}`}
            >
              Edit
            </Button>
          </li>
        ))}
      </ul>

      {newestFirst.length > limit && (
        <Button
          variant="quiet"
          className={styles.more}
          onClick={() => setLimit((current) => current + PAGE_SIZE)}
        >
          Show {Math.min(PAGE_SIZE, newestFirst.length - limit)} more
        </Button>
      )}

      {editing && <SessionEditDialog session={editing} onClose={() => setEditingId(null)} />}
    </>
  );
}
