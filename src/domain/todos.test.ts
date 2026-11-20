import { describe, expect, it } from 'vitest';
import {
  buildTodoBoard,
  buildTodoHistory,
  cleanTodoTitle,
  defaultTodoDay,
  GENERAL,
  nextPlannedDay,
  planTodo,
  targetOf,
  groupTodoTargets,
  todoTargets,
  type Todo,
  type TodoContext,
} from './todos';

// Problem solving is planned on Mondays and Thursdays. 2026-11-16 is a Monday.
const context: TodoContext = {
  domains: [
    { id: 'ps', name: 'Problem solving', icon: '🧩', color: 'persimmon', routineDays: [1, 4] },
  ],
  skills: [
    {
      id: 'cp',
      name: 'Competitive programming',
      icon: '⚔️',
      color: 'persimmon',
      kind: 'skill',
      domainId: 'ps',
      routineDays: [],
    },
    {
      id: 'os',
      name: 'Operating systems',
      icon: '🖥️',
      color: 'teal',
      kind: 'skill',
      domainId: null,
      routineDays: [2],
    },
    {
      id: 'thesis',
      name: 'Senior project',
      icon: '🎓',
      color: 'plum',
      kind: 'project',
      domainId: null,
      routineDays: [],
    },
  ],
};

let n = 0;
const todo = (day: string, extra: Partial<Todo> = {}): Todo => ({
  id: `t${(n += 1)}`,
  title: `todo ${n}`,
  done: false,
  createdAt: n,
  doneAt: null,
  domainId: 'ps',
  skillId: null,
  day,
  ...extra,
});
const at = (day: string) => new Date(`${day}T15:00:00`).getTime();

describe('targets and days', () => {
  it("finds the domain or skill, and a skill follows its domain's days", () => {
    expect(targetOf({ domainId: 'ps', skillId: null }, context).name).toBe('Problem solving');
    expect(targetOf({ domainId: null, skillId: 'cp' }, context).routine).toEqual([1, 4]);
    expect(targetOf({ domainId: null, skillId: 'gone' }, context)).toBe(GENERAL);
  });

  it('puts a new to-do on today if planned, else the next working day', () => {
    const ps = targetOf({ domainId: 'ps', skillId: null }, context);
    expect(defaultTodoDay(ps, '2026-11-16')).toBe('2026-11-16');
    expect(defaultTodoDay(ps, '2026-11-17')).toBe('2026-11-19');
    expect(defaultTodoDay(GENERAL, '2026-11-17')).toBe('2026-11-17');
    expect(nextPlannedDay([0], '2026-11-16')).toBe('2026-11-22');
  });
});

describe('moving on', () => {
  it('moves an undone to-do to the next working day of its domain', () => {
    // Planned Monday, not done. On Tuesday it waits for Thursday.
    const plan = todo('2026-11-16');
    expect(planTodo(plan, context, '2026-11-17')).toMatchObject({ due: '2026-11-19', moved: 1 });
    // Still not done on Thursday: it shows on Thursday, missed once.
    expect(planTodo(plan, context, '2026-11-19')).toMatchObject({ due: '2026-11-19', moved: 1 });
    // Missed Thursday too: next Monday, missed twice.
    expect(planTodo(plan, context, '2026-11-20')).toMatchObject({ due: '2026-11-23', moved: 2 });
  });

  it('moves a General to-do to the next day', () => {
    const plan = todo('2026-11-16', { domainId: null });
    expect(planTodo(plan, context, '2026-11-18')).toMatchObject({ due: '2026-11-18', moved: 2 });
  });

  it('keeps a done to-do on the day it was done', () => {
    const plan = todo('2026-11-16', { done: true, doneAt: at('2026-11-19') });
    expect(planTodo(plan, context, '2026-11-25')).toMatchObject({
      due: '2026-11-19',
      doneDay: '2026-11-19',
      moved: 1,
    });
  });
});

describe('buildTodoBoard', () => {
  it('shows what is due today by domain, what comes later, and what was done today', () => {
    const today = '2026-11-19'; // Thursday
    const board = buildTodoBoard(
      [
        todo('2026-11-16', { title: 'Solve 5 loop problems' }),
        todo('2026-11-19', { domainId: null, title: 'Email supervisor' }),
        todo('2026-11-17', { domainId: null, skillId: 'os', title: 'Read chapter 4' }),
        todo('2026-11-19', { done: true, doneAt: at('2026-11-19'), title: 'Two pointers' }),
      ],
      context,
      today,
    );
    expect(board.today.map((g) => [g.target.name, g.items.map((p) => p.todo.title)])).toEqual([
      ['General', ['Email supervisor']],
      ['Problem solving', ['Solve 5 loop problems']],
    ]);
    // Operating systems missed Tuesday and waits for next Tuesday.
    expect(board.upcoming.map((p) => [p.todo.title, p.due])).toEqual([
      ['Read chapter 4', '2026-11-24'],
    ]);
    expect(board.doneToday.map((p) => p.todo.title)).toEqual(['Two pointers']);
    expect(board.openToday).toBe(2);
  });
});

describe('buildTodoHistory', () => {
  it('records what was done each day and what moved on', () => {
    const history = buildTodoHistory(
      [
        todo('2026-11-16', { title: 'Loops', done: true, doneAt: at('2026-11-19') }),
        todo('2026-11-16', { title: 'Arrays', done: true, doneAt: at('2026-11-16') }),
      ],
      context,
      '2026-11-20',
    );
    expect(
      history.map((d) => [
        d.day,
        d.done.map((p) => p.todo.title),
        d.movedOn.map((p) => p.todo.title),
      ]),
    ).toEqual([
      ['2026-11-19', ['Loops'], []],
      ['2026-11-16', ['Arrays'], ['Loops']],
    ]);
  });

  it('can keep one domain or skill', () => {
    const history = buildTodoHistory(
      [
        todo('2026-11-16', { done: true, doneAt: at('2026-11-16') }),
        todo('2026-11-16', { domainId: null, done: true, doneAt: at('2026-11-16') }),
      ],
      context,
      '2026-11-20',
      { targetKey: 'general' },
    );
    expect(history[0]?.done).toHaveLength(1);
    expect(history[0]?.done[0]?.target).toBe(GENERAL);
  });
});

it('cleans titles', () => {
  expect(cleanTodoTitle('  Solve   5 loops ')).toBe('Solve 5 loops');
  expect(cleanTodoTitle('  ')).toBeNull();
});

it('offers skills, not domains, for a new to-do, but keeps a domain an old one has', () => {
  expect(todoTargets(context).map((t) => t.key)).toEqual([
    'general',
    'skill:cp',
    'skill:os',
    'skill:thesis',
  ]);
  const domain = targetOf({ domainId: 'ps', skillId: null }, context);
  expect(todoTargets(context, domain).map((t) => t.key)).toContain('domain:ps');
});

it('groups the picker into projects, skills and habits, today first', () => {
  // A Tuesday: operating systems is on, problem solving is not, the project is every day.
  const groups = groupTodoTargets(todoTargets(context), '2026-11-17');
  expect(groups.map((g) => [g.label, g.targets.map((t) => t.key)])).toEqual([
    ['Projects', ['skill:thesis']],
    ['Skills', ['skill:os', 'skill:cp']],
  ]);
  const old = targetOf({ domainId: 'ps', skillId: null }, context);
  expect(groupTodoTargets(todoTargets(context, old), '2026-11-17').at(-1)?.label).toBe('Domains');
});
