import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import {
  GENERAL,
  groupTodoTargets,
  isTargetOpenOn,
  TODO_TITLE_MAX,
  type PlannedTodo,
} from '../../domain/todos';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from '../progress/useNow';
import { useTodoBoard, useTodoTargets } from '../progress/useTodos';
import { placeOf, shortDay } from './todoPlace';
import { TodoEditDialog } from './TodoEditDialog';
import { TodoHistoryDialog } from './TodoHistoryDialog';
import styles from './TodoList.module.css';

/**
 * Today's to-dos, by the domain or skill they belong to. One left undone
 * moves on by itself to the next working day of its domain or skill.
 */
export function TodoList() {
  const today = useToday();
  const board = useTodoBoard();
  const targets = useTodoTargets();
  const addTodo = useTrackerStore((state) => state.addTodo);

  const [draft, setDraft] = useState('');
  const [targetKey, setTargetKey] = useState(GENERAL.key);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<PlannedTodo | null>(null);
  const [history, setHistory] = useState(false);

  // The day decides the list: only what the routine plans for it is offered.
  const day = pickedDay ?? today;
  const picked = targets.find((t) => t.key === targetKey) ?? GENERAL;
  const target = isTargetOpenOn(picked, day) ? picked : GENERAL;
  const groups = groupTodoTargets(targets, day);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (addTodo(draft, { ...placeOf(target), day })) {
      setDraft('');
      setPickedDay(null);
    }
  };

  return (
    <section className={styles.card} aria-labelledby="todo-title">
      <div className={styles.head}>
        <h2 id="todo-title" className={styles.title}>
          To-do
        </h2>
        <p className={`tabular ${styles.count}`}>
          {board.openToday > 0
            ? `${board.openToday} left today`
            : board.doneToday.length > 0
              ? 'All done for today'
              : ''}
        </p>
        <Button size="sm" variant="quiet" onClick={() => setHistory(true)}>
          History
        </Button>
      </div>

      <form className={styles.add} onSubmit={submit}>
        <label htmlFor="todo-new" className="visually-hidden">
          New to-do
        </label>
        <input
          id="todo-new"
          className={styles.input}
          value={draft}
          maxLength={TODO_TITLE_MAX}
          placeholder="Solve 5 loop problems"
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className={styles.addRow}>
          <label className={styles.place}>
            <span className="visually-hidden">To-do belongs to</span>
            <select value={target.key} onChange={(event) => setTargetKey(event.target.value)}>
              <option value={GENERAL.key}>📝 General</option>
              {groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.targets.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.icon} {t.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className={styles.place}>
            <span className="visually-hidden">To-do day</span>
            <input
              type="date"
              value={day}
              min={today}
              onChange={(event) => setPickedDay(event.target.value || null)}
            />
          </label>
          <Button type="submit" size="sm" disabled={draft.trim() === ''}>
            Add
          </Button>
        </div>
        <p className={styles.addHint}>
          {day === today ? 'For today' : `For ${shortDay(day)}`}
          {target === GENERAL ? '' : `, under ${target.name}`}. The list shows what your routine
          plans for that day. Not done by then, it moves on to the next working day by itself.
        </p>
      </form>

      {board.today.length === 0 ? (
        <p className={styles.empty}>
          {board.doneToday.length > 0
            ? 'Everything for today is done.'
            : 'Nothing for today. Write down what you want to get done, and pick its skill.'}
        </p>
      ) : (
        board.today.map(({ target: group, items }) => (
          <div key={group.key} className={styles.group} data-color={group.color ?? undefined}>
            <h3 className={styles.groupName}>
              <span aria-hidden="true">{group.icon}</span> {group.name}
            </h3>
            <ul className={styles.items}>
              {items.map((item) => (
                <TodoItem key={item.todo.id} item={item} onEdit={() => setEditing(item)} />
              ))}
            </ul>
          </div>
        ))
      )}

      {board.upcoming.length > 0 && (
        <Fold
          label="Coming up"
          count={board.upcoming.length}
          open={showUpcoming}
          onToggle={() => setShowUpcoming(!showUpcoming)}
        >
          <ul className={styles.items}>
            {board.upcoming.map((item) => (
              <TodoItem key={item.todo.id} item={item} onEdit={() => setEditing(item)} showWhen />
            ))}
          </ul>
        </Fold>
      )}

      {board.doneToday.length > 0 && (
        <Fold
          label="Done today"
          count={board.doneToday.length}
          open={showDone}
          onToggle={() => setShowDone(!showDone)}
        >
          <ul className={styles.items}>
            {board.doneToday.map((item) => (
              <TodoItem key={item.todo.id} item={item} onEdit={() => setEditing(item)} showPlace />
            ))}
          </ul>
        </Fold>
      )}

      {editing && <TodoEditDialog item={editing} onClose={() => setEditing(null)} />}
      {history && <TodoHistoryDialog onClose={() => setHistory(false)} />}
    </section>
  );
}

function Fold({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.fold}>
      <button type="button" className={styles.foldToggle} aria-expanded={open} onClick={onToggle}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
        {label} <span className="tabular">{count}</span>
      </button>
      {open && children}
    </div>
  );
}

function TodoItem({
  item,
  onEdit,
  showWhen = false,
  showPlace = false,
}: {
  item: PlannedTodo;
  onEdit: () => void;
  showWhen?: boolean;
  showPlace?: boolean;
}) {
  const toggleTodo = useTrackerStore((state) => state.toggleTodo);
  const deleteTodo = useTrackerStore((state) => state.deleteTodo);
  const { todo, target, moved, due } = item;

  return (
    <li className={styles.item} data-done={todo.done}>
      <label className={styles.check}>
        <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo.id)} />
        <span className="visually-hidden">
          {todo.done ? 'Mark as not done' : 'Mark as done'}: {todo.title}
        </span>
      </label>
      <button
        type="button"
        className={styles.text}
        onClick={onEdit}
        aria-label={`Edit ${todo.title}`}
        title="Edit, move or change its domain"
      >
        <span>{todo.title}</span>
        {(showWhen || showPlace || moved > 0) && (
          <span className={styles.meta}>
            {showWhen && `${shortDay(due)}, ${target.icon} ${target.name}`}
            {showPlace && `${target.icon} ${target.name}`}
            {moved > 0 && (
              <span className={styles.moved}>
                {showWhen || showPlace ? ', ' : ''}moved {moved === 1 ? 'once' : `${moved} times`},
                planned {shortDay(todo.day)}
              </span>
            )}
          </span>
        )}
      </button>
      <button
        type="button"
        className={styles.remove}
        onClick={() => deleteTodo(todo.id)}
        aria-label={`Delete ${todo.title}`}
        title="Delete"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </li>
  );
}
