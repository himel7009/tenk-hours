import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { Select } from '../../components/Field';
import { useTodoHistory, useTodoTargets } from '../progress/useTodos';
import { shortDay } from './todoPlace';
import styles from './TodoList.module.css';

/** Day by day: what got done, and what was planned but moved on. */
export function TodoHistoryDialog({ onClose }: { onClose: () => void }) {
  const targets = useTodoTargets();
  const [targetKey, setTargetKey] = useState('');
  const history = useTodoHistory(targetKey || undefined, 60);
  const done = history.reduce((sum, day) => sum + day.done.length, 0);
  const moved = history.reduce((sum, day) => sum + day.movedOn.length, 0);

  return (
    <Dialog title="To-do history" onClose={onClose}>
      <div className={styles.history}>
        <div className={styles.historyBar}>
          <Select
            aria-label="Show"
            value={targetKey}
            onChange={(event) => setTargetKey(event.target.value)}
          >
            <option value="">Everything</option>
            {targets.map((target) => (
              <option key={target.key} value={target.key}>
                {target.icon} {target.name}
              </option>
            ))}
          </Select>
          <p className="tabular">
            Last 60 days: <strong>{done} done</strong>, {moved} times moved on
          </p>
        </div>

        {history.length === 0 ? (
          <p className={styles.empty}>Nothing yet. Done and missed to-dos show up here by day.</p>
        ) : (
          <ol className={styles.historyDays}>
            {history.map((entry) => (
              <li key={entry.day}>
                <h3>{shortDay(entry.day)}</h3>
                <ul>
                  {entry.done.map(({ todo, target }) => (
                    <li key={`d${todo.id}`} data-state="done">
                      <span aria-hidden="true">✓</span>
                      <span className={styles.historyTitle}>{todo.title}</span>
                      <span className={styles.meta}>
                        {target.icon} {target.name}
                      </span>
                    </li>
                  ))}
                  {entry.movedOn.map(({ todo, target }) => (
                    <li key={`m${todo.id}`} data-state="moved">
                      <span aria-hidden="true">↷</span>
                      <span className={styles.historyTitle}>
                        {todo.title}
                        <span className="visually-hidden"> (not done, moved on)</span>
                      </span>
                      <span className={styles.meta}>
                        {target.icon} {target.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Dialog>
  );
}
