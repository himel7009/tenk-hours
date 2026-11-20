import { useMemo } from 'react';
import {
  buildTodoBoard,
  buildTodoHistory,
  todoTargets,
  type TodoBoard,
  type TodoContext,
  type TodoHistoryDay,
  type TodoTarget,
} from '../../domain/todos';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from './useNow';

/** Domains and trackers, as the to-do planner sees them. */
export function useTodoContext(): TodoContext {
  const domains = useTrackerStore((state) => state.domains);
  const skills = useTrackerStore((state) => state.skills);
  return useMemo(() => ({ domains, skills }), [domains, skills]);
}

/** Today's to-dos by domain and skill, what comes later, and what was done today. */
export function useTodoBoard(): TodoBoard {
  const todos = useTrackerStore((state) => state.todos);
  const context = useTodoContext();
  const today = useToday();
  return useMemo(() => buildTodoBoard(todos, context, today), [todos, context, today]);
}

export function useTodoHistory(targetKey: string | undefined, days = 30): TodoHistoryDay[] {
  const todos = useTrackerStore((state) => state.todos);
  const context = useTodoContext();
  const today = useToday();
  return useMemo(
    () => buildTodoHistory(todos, context, today, { targetKey, days }),
    [todos, context, today, targetKey, days],
  );
}

export function useTodoTargets(): TodoTarget[] {
  const context = useTodoContext();
  return useMemo(() => todoTargets(context), [context]);
}
