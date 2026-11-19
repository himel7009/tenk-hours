import { describe, expect, it } from 'vitest';
import { cleanTodoTitle, sortTodos, type Todo } from './todos';

const todo = (id: string, createdAt: number, doneAt: number | null = null): Todo => ({
  id,
  title: id,
  done: doneAt !== null,
  createdAt,
  doneAt,
});

describe('sortTodos', () => {
  it('keeps open items in the order written and puts the latest done first', () => {
    const { open, done } = sortTodos([
      todo('b', 2),
      todo('a', 1),
      todo('x', 0, 5),
      todo('y', 0, 9),
    ]);
    expect(open.map((t) => t.id)).toEqual(['a', 'b']);
    expect(done.map((t) => t.id)).toEqual(['y', 'x']);
  });
});

describe('cleanTodoTitle', () => {
  it('trims, collapses spaces and rejects empty titles', () => {
    expect(cleanTodoTitle('  Read   chapter 4 ')).toBe('Read chapter 4');
    expect(cleanTodoTitle('   ')).toBeNull();
    expect(cleanTodoTitle('x'.repeat(300))).toHaveLength(200);
  });
});
