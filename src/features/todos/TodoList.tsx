import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '../../components/Button';
import { sortTodos, TODO_TITLE_MAX, type Todo } from '../../domain/todos';
import { useTrackerStore } from '../../store/trackerStore';
import styles from './TodoList.module.css';

/** A plain checklist: write it down, tick it off, clear the done ones. */
export function TodoList() {
  const todos = useTrackerStore((state) => state.todos);
  const addTodo = useTrackerStore((state) => state.addTodo);
  const clearDoneTodos = useTrackerStore((state) => state.clearDoneTodos);
  const { open, done } = useMemo(() => sortTodos(todos), [todos]);
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (addTodo(draft)) setDraft('');
  };

  return (
    <section className={styles.card} aria-labelledby="todo-title">
      <div className={styles.head}>
        <h2 id="todo-title" className={styles.title}>
          To-do
        </h2>
        {todos.length > 0 && (
          <p className={`tabular ${styles.count}`}>
            {open.length === 0 ? 'All done' : `${open.length} left`}
          </p>
        )}
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
          placeholder="Add a to-do and press Enter"
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" size="sm" disabled={draft.trim() === ''}>
          Add
        </Button>
      </form>

      {open.length > 0 && (
        <ul className={styles.items}>
          {open.map((todo) => (
            <TodoItem key={todo.id} todo={todo} />
          ))}
        </ul>
      )}
      {todos.length === 0 && (
        <p className={styles.empty}>Nothing yet. Write down what you want to get done.</p>
      )}

      {done.length > 0 && (
        <div className={styles.doneBlock}>
          <div className={styles.doneHead}>
            <button
              type="button"
              className={styles.doneToggle}
              aria-expanded={showDone}
              onClick={() => setShowDone(!showDone)}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 6l4 4 4-4" />
              </svg>
              Done <span className="tabular">{done.length}</span>
            </button>
            <Button size="sm" variant="quiet" onClick={clearDoneTodos}>
              Clear done
            </Button>
          </div>
          {showDone && (
            <ul className={styles.items}>
              {done.map((todo) => (
                <TodoItem key={todo.id} todo={todo} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function TodoItem({ todo }: { todo: Todo }) {
  const toggleTodo = useTrackerStore((state) => state.toggleTodo);
  const renameTodo = useTrackerStore((state) => state.renameTodo);
  const deleteTodo = useTrackerStore((state) => state.deleteTodo);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(todo.title);

  const finish = () => {
    if (text.trim() !== '') renameTodo(todo.id, text);
    else setText(todo.title);
    setEditing(false);
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') finish();
    if (event.key === 'Escape') {
      setText(todo.title);
      setEditing(false);
    }
  };

  return (
    <li className={styles.item} data-done={todo.done}>
      <label className={styles.check}>
        <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo.id)} />
        <span className="visually-hidden">
          {todo.done ? 'Mark as not done' : 'Mark as done'}: {todo.title}
        </span>
      </label>
      {editing ? (
        <input
          className={styles.edit}
          value={text}
          maxLength={TODO_TITLE_MAX}
          aria-label="Edit to-do"
          autoFocus
          onChange={(event) => setText(event.target.value)}
          onBlur={finish}
          onKeyDown={onKey}
        />
      ) : (
        <button
          type="button"
          className={styles.text}
          onClick={() => setEditing(true)}
          aria-label={`Edit ${todo.title}`}
          title="Click to edit"
        >
          {todo.title}
        </button>
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
