import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import {
  GENERAL,
  groupTodoTargets,
  isTargetOpenOn,
  cleanTodoUrl,
  describeDeadline,
  linkSite,
  targetKindName,
  TODO_TITLE_MAX,
  type PlannedTodo,
} from '../../domain/todos';
import { daysBetween, type DayKey } from '../../domain/dates';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from '../progress/useNow';
import { useTodoBoard, useTodoTargets } from '../progress/useTodos';
import { placeOf, shortDay } from './todoPlace';
import { DeadlinePicker } from './DeadlinePicker';
import { TodoEditDialog } from './TodoEditDialog';
import { TodoHistoryDialog } from './TodoHistoryDialog';
import styles from './TodoList.module.css';

/** "7 days after", "the same day": the deadline counted from the planned day. */
function daysFromNow(deadline: DayKey, from: DayKey): string {
  const days = daysBetween(from, deadline);
  if (days <= 0) return 'the same day';
  return `${days} day${days === 1 ? '' : 's'} after`;
}

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
  const [deadline, setDeadline] = useState<DayKey | null>(null);
  // Null while the link box is closed.
  const [link, setLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState(false);
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
    // A deadline before the planned day moves up to it.
    const due = deadline !== null && deadline < day ? day : deadline;
    const url = cleanTodoUrl(link ?? '');
    if (url === null) {
      setLinkError(true);
      return;
    }
    if (addTodo(draft, { ...placeOf(target), day }, { deadline: due, url })) {
      setDraft('');
      setPickedDay(null);
      setDeadline(null);
      setLink(null);
      setLinkError(false);
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

      <form className={styles.add} onSubmit={submit} noValidate>
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
        {link !== null && (
          <div className={styles.linkRow}>
            <label htmlFor="todo-link" className="visually-hidden">
              Link
            </label>
            <input
              id="todo-link"
              type="url"
              inputMode="url"
              className={styles.input}
              value={link}
              placeholder="Paste a link to a video or page"
              autoComplete="off"
              aria-invalid={linkError || undefined}
              aria-describedby={linkError ? 'todo-link-error' : undefined}
              onChange={(event) => {
                setLink(event.target.value);
                setLinkError(false);
              }}
            />
            <Button
              size="sm"
              variant="quiet"
              aria-label="Remove the link"
              onClick={() => {
                setLink(null);
                setLinkError(false);
              }}
            >
              ✕
            </Button>
          </div>
        )}
        {linkError && (
          <p id="todo-link-error" className={styles.linkError} role="alert">
            That is not a web link. Paste one that starts with https://, or remove it.
          </p>
        )}
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
          <DeadlinePicker value={deadline} onChange={setDeadline} from={day} />
          {link === null && (
            <Button
              size="sm"
              variant="quiet"
              className={styles.deadlineOff}
              aria-label="Add a link"
              onClick={() => setLink('')}
            >
              🔗 Link
            </Button>
          )}
          <Button type="submit" size="sm" disabled={draft.trim() === ''}>
            Add
          </Button>
        </div>
        <p className={styles.addHint}>
          {day === today ? 'For today' : `For ${shortDay(day)}`}
          {target === GENERAL ? '' : `, under ${target.name}`}
          {deadline === null
            ? ', no deadline'
            : `, due ${shortDay(deadline)} (${daysFromNow(deadline, day)})`}
          . The list shows what your routine plans for that day. Not done by then, it moves on to
          the next working day by itself.
        </p>
      </form>

      {board.today.length === 0 ? (
        <p className={styles.empty}>
          {board.doneToday.length > 0
            ? 'Everything for today is done.'
            : 'Nothing for today. Write down what you want to get done, and pick its skill.'}
        </p>
      ) : (
        // A long day scrolls inside the card rather than pushing the page down.
        <div
          className={styles.todayList}
          tabIndex={0}
          aria-label="Today's to-dos"
          data-long={board.today.reduce((n, g) => n + g.items.length, 0) > 6 || undefined}
        >
          {board.today.map(({ target: group, items }) => (
            <div key={group.key} className={styles.group} data-color={group.color ?? undefined}>
              <h3 className={styles.groupName}>
                <span aria-hidden="true">{group.icon}</span> {group.name}
                {targetKindName(group) && (
                  <span className={styles.kind}>{targetKindName(group)}</span>
                )}
              </h3>
              <ul className={styles.items}>
                {items.map((item) => (
                  <TodoItem key={item.todo.id} item={item} onEdit={() => setEditing(item)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
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
  const { todo, target, moved, due, addedDay, age } = item;
  const deadline = describeDeadline(item);
  const today = useToday();
  const place = `${target.icon} ${target.name}${
    targetKindName(target) ? ` (${targetKindName(target).toLowerCase()})` : ''
  }`;
  // How long it has been going: "Day 3, added Thu, Nov 19". Done ones say how
  // long they took.
  const life = todo.done
    ? age === 1
      ? 'Done the day it was added'
      : `Done on day ${age}, added ${shortDay(addedDay)}`
    : addedDay === today
      ? 'Added today'
      : `Day ${age}, added ${shortDay(addedDay)}`;

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
        {deadline && (
          <span className={styles.deadline} data-tone={deadline.tone}>
            {deadline.text}
            {!todo.done && todo.deadline && `, ${shortDay(todo.deadline)}`}
          </span>
        )}
        <span className={styles.meta}>
          {showWhen && `${shortDay(due)}, ${place}. `}
          {showPlace && `${place}. `}
          <span className={styles.age} data-long={(!todo.done && age >= 3) || undefined}>
            {life}
          </span>
          {moved > 0 && (
            <span className={styles.moved}>
              , moved {moved === 1 ? 'once' : `${moved} times`}
              {todo.day !== addedDay && `, planned ${shortDay(todo.day)}`}
            </span>
          )}
        </span>
      </button>
      {todo.url && (
        <a
          className={styles.link}
          href={todo.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open the link for ${todo.title}, ${linkSite(todo.url)}, in a new tab`}
          title={todo.url}
        >
          <span aria-hidden="true">🔗</span> {linkSite(todo.url)}
        </a>
      )}
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
