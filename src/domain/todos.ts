/** A plain to-do. No dates and no history: done items stay until cleared. */
export type TodoId = string;

export interface Todo {
  id: TodoId;
  title: string;
  done: boolean;
  createdAt: number;
  /** When it was ticked off, for ordering the done list. Null while open. */
  doneAt: number | null;
}

export const TODO_TITLE_MAX = 200;

/** Open items oldest first, as written down; done items most recent first. */
export function sortTodos(todos: readonly Todo[]): { open: Todo[]; done: Todo[] } {
  return {
    open: todos.filter((todo) => !todo.done).sort((a, b) => a.createdAt - b.createdAt),
    done: todos.filter((todo) => todo.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
  };
}

/** Trims and shortens a title, or null if nothing is left. */
export function cleanTodoTitle(value: string): string | null {
  const title = value.replace(/\s+/g, ' ').trim().slice(0, TODO_TITLE_MAX);
  return title === '' ? null : title;
}
