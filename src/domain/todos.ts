import { addDays, daysBetween, toDayKey, type DayKey } from './dates';
import { isPlannedOn, routineOf, type Weekday } from './routine';
import type { TrackerKind } from './types';

/**
 * A to-do belongs to a domain, a skill (or habit or project), or neither
 * ("General"), and is planned for a day. One left undone moves itself to the
 * next day its domain or skill is on the routine, so nothing is lost and
 * nothing has to be copied by hand. Moving is worked out, never stored: the
 * to-do keeps the day it was first planned for, which is what the history
 * reads.
 */
export type TodoId = string;

export interface Todo {
  id: TodoId;
  title: string;
  done: boolean;
  createdAt: number;
  /** When it was ticked off. Null while open. */
  doneAt: number | null;
  /** At most one of these is set; neither means General. */
  domainId: string | null;
  skillId: string | null;
  /** The day it was planned for. */
  day: DayKey;
}

export const TODO_TITLE_MAX = 200;

/** Trims and shortens a title, or null if nothing is left. */
export function cleanTodoTitle(value: string): string | null {
  const title = value.replace(/\s+/g, ' ').trim().slice(0, TODO_TITLE_MAX);
  return title === '' ? null : title;
}

/** What the planner needs to know about domains and trackers. */
export interface TodoContext {
  domains: readonly {
    id: string;
    name: string;
    icon: string;
    color: string;
    routineDays: readonly Weekday[];
  }[];
  skills: readonly {
    id: string;
    name: string;
    icon: string;
    color: string;
    kind: TrackerKind;
    domainId: string | null;
    routineDays: readonly Weekday[];
  }[];
}

export interface TodoTarget {
  /** "domain:<id>", "skill:<id>" or "general". */
  key: string;
  name: string;
  icon: string;
  color: string | null;
  routine: readonly Weekday[];
  /** What it is, for grouping the picker. */
  kind: 'general' | 'domain' | TrackerKind;
}

export const GENERAL: TodoTarget = {
  key: 'general',
  name: 'General',
  icon: '📝',
  color: null,
  routine: [],
  kind: 'general',
};

/** The domain or skill a to-do belongs to. One whose target was deleted becomes General. */
export function targetOf(
  todo: Pick<Todo, 'domainId' | 'skillId'>,
  context: TodoContext,
): TodoTarget {
  if (todo.domainId) {
    const domain = context.domains.find((d) => d.id === todo.domainId);
    if (domain) {
      return {
        key: `domain:${domain.id}`,
        name: domain.name,
        icon: domain.icon,
        color: domain.color,
        routine: domain.routineDays,
        kind: 'domain',
      };
    }
  }
  if (todo.skillId) {
    const skill = context.skills.find((s) => s.id === todo.skillId);
    if (skill) {
      return {
        key: `skill:${skill.id}`,
        name: skill.name,
        icon: skill.icon,
        color: skill.color,
        routine: routineOf(skill, context.domains),
        kind: skill.kind,
      };
    }
  }
  return GENERAL;
}

/** The first day on or after `from` that the routine plans for. */
export function nextPlannedDay(routine: readonly Weekday[], from: DayKey): DayKey {
  for (let step = 0; step < 7; step += 1) {
    const day = addDays(from, step);
    if (isPlannedOn(routine, day)) return day;
  }
  return from;
}

/** The day a new to-do for this target lands on: today if it is planned, else its next working day. */
export function defaultTodoDay(target: TodoTarget, today: DayKey): DayKey {
  return nextPlannedDay(target.routine, today);
}

export interface PlannedTodo {
  todo: Todo;
  target: TodoTarget;
  /** The day it shows on now: its own day, or, if that passed undone, the next working day. */
  due: DayKey;
  /** Working days it was planned for and not done, so it moved on. */
  moved: number;
  /** The day it was done, in local time. */
  doneDay: DayKey | null;
  /** The day it was written down, in local time. */
  addedDay: DayKey;
  /**
   * Which day of its life it is on: 1 on the day it was added, counting
   * every calendar day since. A done one stops at the day it was done.
   */
  age: number;
}

/** Days the target was planned for from `from` up to, not including, `to`. */
function plannedDaysBetween(routine: readonly Weekday[], from: DayKey, to: DayKey): DayKey[] {
  const days: DayKey[] = [];
  for (let day = from; day < to; day = addDays(day, 1)) {
    if (isPlannedOn(routine, day)) days.push(day);
  }
  return days;
}

export function planTodo(todo: Todo, context: TodoContext, today: DayKey): PlannedTodo {
  const target = targetOf(todo, context);
  const doneDay = todo.done && todo.doneAt !== null ? toDayKey(new Date(todo.doneAt)) : null;
  const due = todo.done
    ? (doneDay ?? todo.day)
    : todo.day >= today
      ? todo.day
      : nextPlannedDay(target.routine, today);
  // Every working day between the plan and the day it shows on (or was done) was missed.
  const until = todo.done ? (doneDay ?? todo.day) : due;
  const moved = until > todo.day ? plannedDaysBetween(target.routine, todo.day, until).length : 0;
  const addedDay = toDayKey(new Date(todo.createdAt));
  const age = Math.max(1, daysBetween(addedDay, doneDay ?? today) + 1);
  return { todo, target, due, moved, doneDay, addedDay, age };
}

export interface TodoBoard {
  /** Open and due today or earlier, grouped by target, General first. */
  today: { target: TodoTarget; items: PlannedTodo[] }[];
  /** Open and due later, soonest first. */
  upcoming: PlannedTodo[];
  /** Done today. */
  doneToday: PlannedTodo[];
  openToday: number;
}

export function buildTodoBoard(
  todos: readonly Todo[],
  context: TodoContext,
  today: DayKey,
): TodoBoard {
  const planned = todos.map((todo) => planTodo(todo, context, today));
  const dueNow = planned
    .filter((p) => !p.todo.done && p.due <= today)
    .sort((a, b) => a.todo.day.localeCompare(b.todo.day) || a.todo.createdAt - b.todo.createdAt);
  const groups = new Map<string, { target: TodoTarget; items: PlannedTodo[] }>();
  for (const item of dueNow) {
    const group = groups.get(item.target.key) ?? { target: item.target, items: [] };
    group.items.push(item);
    groups.set(item.target.key, group);
  }
  return {
    today: [...groups.values()].sort(
      (a, b) =>
        Number(b.target === GENERAL) - Number(a.target === GENERAL) ||
        a.target.name.localeCompare(b.target.name),
    ),
    upcoming: planned
      .filter((p) => !p.todo.done && p.due > today)
      .sort((a, b) => a.due.localeCompare(b.due) || a.todo.createdAt - b.todo.createdAt),
    doneToday: planned
      .filter((p) => p.doneDay === today)
      .sort((a, b) => (b.todo.doneAt ?? 0) - (a.todo.doneAt ?? 0)),
    openToday: dueNow.length,
  };
}

export interface TodoHistoryDay {
  day: DayKey;
  done: PlannedTodo[];
  /** Planned for this working day and left undone, so they moved on. */
  movedOn: PlannedTodo[];
}

/**
 * What happened to the to-dos day by day, newest first: what was done, and
 * what was planned but carried to the next working day. `targetKey` keeps
 * one domain or skill.
 */
export function buildTodoHistory(
  todos: readonly Todo[],
  context: TodoContext,
  today: DayKey,
  options: { days?: number; targetKey?: string } = {},
): TodoHistoryDay[] {
  const span = options.days ?? 30;
  const planned = todos
    .map((todo) => planTodo(todo, context, today))
    .filter((p) => !options.targetKey || p.target.key === options.targetKey);
  const history: TodoHistoryDay[] = [];
  for (let back = 0; back < span; back += 1) {
    const day = addDays(today, -back);
    const done = planned.filter((p) => p.doneDay === day);
    // Missed on a past working day of its target, between its plan and its finish.
    const movedOn =
      day >= today
        ? []
        : planned.filter((p) => {
            const end = p.doneDay ?? p.due;
            return p.todo.day <= day && day < end && isPlannedOn(p.target.routine, day);
          });
    if (done.length > 0 || movedOn.length > 0) history.push({ day, done, movedOn });
  }
  return history;
}

/**
 * The places offered for a new to-do: General and every skill, habit and
 * project. Domains are left out on purpose: a to-do is for one skill, and
 * the skill still follows its domain's days. `keep` adds back the place an
 * existing to-do already has, such as a domain, so editing never moves it.
 */
export function todoTargets(context: TodoContext, keep?: TodoTarget): TodoTarget[] {
  const targets = [
    GENERAL,
    ...context.skills.map((skill) => targetOf({ domainId: null, skillId: skill.id }, context)),
  ];
  return keep && !targets.some((target) => target.key === keep.key) ? [...targets, keep] : targets;
}

export interface TodoTargetGroup {
  label: string;
  targets: TodoTarget[];
}

const GROUPS: { kind: TodoTarget['kind']; label: string }[] = [
  { kind: 'project', label: 'Projects' },
  { kind: 'skill', label: 'Skills' },
  { kind: 'habit', label: 'Habits' },
  // Only a to-do made before domains left the list can still point at one.
  { kind: 'domain', label: 'Domains' },
];

/**
 * The picker's groups, General left out: the projects, skills and habits the
 * routine plans for `day`, so a to-do only goes where that day's work is.
 * `keepKey` stays listed whatever the day (the place a to-do already has).
 * Empty groups are dropped.
 */
export function groupTodoTargets(
  targets: readonly TodoTarget[],
  day: DayKey,
  keepKey?: string,
): TodoTargetGroup[] {
  return GROUPS.map(({ kind, label }) => ({
    label,
    targets: targets.filter(
      (target) =>
        target.kind === kind && (target.key === keepKey || isPlannedOn(target.routine, day)),
    ),
  })).filter((group) => group.targets.length > 0);
}

/** Whether a to-do can be planned under `target` on `day`. General always can. */
export function isTargetOpenOn(target: TodoTarget, day: DayKey): boolean {
  return target === GENERAL || isPlannedOn(target.routine, day);
}

const KIND_NAMES: Record<TodoTarget['kind'], string> = {
  general: '',
  domain: 'Domain',
  skill: 'Skill',
  habit: 'Habit',
  project: 'Project',
};

/** "Skill", "Habit", "Project" or "Domain"; empty for General. */
export function targetKindName(target: TodoTarget): string {
  return KIND_NAMES[target.kind];
}
