import type { TodoTarget } from '../../domain/todos';
import type { TodoPlace } from '../../store/trackerStore';

/** The stored place for a target picked in a form. */
export function placeOf(target: TodoTarget): Omit<TodoPlace, 'day'> {
  const [kind, id] = target.key.split(':');
  return {
    domainId: kind === 'domain' ? id! : null,
    skillId: kind === 'skill' ? id! : null,
  };
}

export const shortDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
