import { Link } from 'react-router';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import {
  GENERAL,
  groupTodoTargets,
  unplannedToday,
  cleanTodoUrl,
  describeDeadline,
  linkSite,
  targetKindName,
  TODO_TITLE_MAX,
  type PlannedTodo,
  type TodoTarget,
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
  const input = useRef<HTMLInputElement>(null);
  const [targetKey, setTargetKey] = useState(GENERAL.key);
  const [deadline, setDeadline] = useState<DayKey | null>(null);
  // Null while the link box is closed.
  const [link, setLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<PlannedTodo | null>(null);
  const [history, setHistory] = useState(false);

  // New to-dos are for today; one not done comes back on its next routine day.
  const day = today;
  const target = targets.find((t) => t.key === targetKey) ?? GENERAL;
  const groups = groupTodoTargets(targets, day);
  // A quiet reminder of what today's routine holds with no to-do yet.
  const unplanned = unplannedToday(targets, board, today);

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
          ref={input}
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
                      {group.offRoutine ? ` (${targetKindName(t).toLowerCase()})` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
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
          For today
          {target === GENERAL ? '' : `, under ${target.name}`}
          {deadline === null
            ? ', no deadline'
            : `, due ${shortDay(deadline)} (${daysFromNow(deadline, day)})`}
          . Not done today, it comes back on its next routine day until you tick it off.
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
          data-long={board.todayItems.length > 6 || undefined}
        >
          <ul className={styles.items}>
            {board.todayItems.map((item) => (
              <TodoItem key={item.todo.id} item={item} onEdit={() => setEditing(item)} placeTag />
            ))}
          </ul>
        </div>
      )}

      {unplanned.length > 0 && (
        <p className={styles.unplanned}>
          On your routine with nothing planned:{' '}
          {unplanned.map((t, i) => (
            <span key={t.key}>
              {i > 0 && ', '}
              <button
                type="button"
                className={styles.unplannedName}
                title={`Write a to-do for ${t.name}`}
                onClick={() => {
                  setTargetKey(t.key);
                  input.current?.focus();
                }}
              >
                <span aria-hidden="true">{t.icon}</span> {t.name}
              </button>
            </span>
          ))}
        </p>
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
  placeTag = false,
}: {
  item: PlannedTodo;
  onEdit: () => void;
  showWhen?: boolean;
  showPlace?: boolean;
  /** Names its skill, habit or project above the title, linked to its page. */
  placeTag?: boolean;
}) {
  const toggleTodo = useTrackerStore((state) => state.toggleTodo);
  const deleteTodo = useTrackerStore((state) => state.deleteTodo);
  const { todo, target, due, addedDay, age, workingDaysLeft } = item;
  const deadline = describeDeadline(item);
  const today = useToday();
  const place = `${target.icon} ${target.name}${
    targetKindName(target) ? ` (${targetKindName(target).toLowerCase()})` : ''
  }`;
  // Only when it was written down: no counting of days or moves, which
  // reads as pressure.
  const life = todo.done
    ? age === 1
      ? 'Done the day it was added'
      : `Done, added ${shortDay(addedDay)}`
    : addedDay === today
      ? 'Added today'
      : `Added ${shortDay(addedDay)}`;

  return (
    <li className={styles.item} data-done={todo.done} data-color={target.color ?? undefined}>
      <label className={styles.check}>
        <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo.id)} />
        <span className="visually-hidden">
          {todo.done ? 'Mark as not done' : 'Mark as done'}: {todo.title}
        </span>
      </label>
      <div className={styles.body}>
        {placeTag && target !== GENERAL && <PlaceTag target={target} />}
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
              {workingDaysLeft !== null
                ? `${workingDaysLeft} working day${workingDaysLeft === 1 ? '' : 's'} left`
                : deadline.text}
              {!todo.done &&
                todo.deadline &&
                // "Due tomorrow" and "Overdue" already say it is a due date.
                `, ${workingDaysLeft === null && /due/i.test(deadline.text) ? '' : 'due '}${shortDay(todo.deadline)}`}
            </span>
          )}
          <span className={styles.meta}>
            {showWhen && `${shortDay(due)}, ${place}. `}
            {showPlace && `${place}. `}
            <span className={styles.age}>{life}</span>
          </span>
        </button>
      </div>
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

/** The skill, habit or project a to-do belongs to; opens its page. */
function PlaceTag({ target }: { target: TodoTarget }) {
  const label = (
    <>
      <span aria-hidden="true">{target.icon}</span> {target.name}
      {targetKindName(target) && <span className={styles.kind}>{targetKindName(target)}</span>}
    </>
  );
  return target.key.startsWith('skill:') ? (
    <Link className={styles.placeTag} to={`/skills/${target.key.slice('skill:'.length)}`}>
      {label}
    </Link>
  ) : (
    <span className={styles.placeTag}>{label}</span>
  );
}
