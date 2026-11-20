import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input, Select } from '../../components/Field';
import { defaultTodoDay, GENERAL, TODO_TITLE_MAX, type PlannedTodo } from '../../domain/todos';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from '../progress/useNow';
import { useTodoTargets } from '../progress/useTodos';
import formStyles from '../skills/SkillFormDialog.module.css';
import { placeOf } from './todoPlace';

/** Rename a to-do, move it to another domain or skill, or plan it for another day. */
export function TodoEditDialog({ item, onClose }: { item: PlannedTodo; onClose: () => void }) {
  const today = useToday();
  const targets = useTodoTargets();
  const updateTodo = useTrackerStore((state) => state.updateTodo);
  const deleteTodo = useTrackerStore((state) => state.deleteTodo);
  const toast = useToastStore((state) => state.show);

  const [title, setTitle] = useState(item.todo.title);
  const [targetKey, setTargetKey] = useState(item.target.key);
  // An open to-do is edited from where it shows now; a done one keeps its day.
  const [day, setDay] = useState(item.todo.done ? item.todo.day : item.due);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const target = targets.find((t) => t.key === targetKey) ?? GENERAL;
    const moved = day !== item.due || targetKey !== item.target.key;
    updateTodo(item.todo.id, {
      title,
      ...placeOf(target),
      // Moving resets the plan; leaving it alone keeps the history of misses.
      day: moved ? day : item.todo.day,
    });
    toast('Changes saved');
    onClose();
  };

  return (
    <Dialog title="Edit to-do" onClose={onClose}>
      <form className={formStyles.form} onSubmit={submit} noValidate>
        <Field label="To-do">
          {(id) => (
            <Input
              id={id}
              value={title}
              maxLength={TODO_TITLE_MAX}
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
            />
          )}
        </Field>
        <div className={formStyles.numbers}>
          <Field label="Belongs to">
            {(id) => (
              <Select
                id={id}
                value={targetKey}
                onChange={(event) => {
                  setTargetKey(event.target.value);
                  const next = targets.find((t) => t.key === event.target.value) ?? GENERAL;
                  if (!item.todo.done) setDay(defaultTodoDay(next, today));
                }}
              >
                {targets.map((target) => (
                  <option key={target.key} value={target.key}>
                    {target.icon} {target.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Day">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={day}
                disabled={item.todo.done}
                onChange={(event) => setDay(event.target.value || day)}
              />
            )}
          </Field>
        </div>
        <div className={formStyles.actions}>
          <Button
            variant="quiet"
            onClick={() => {
              deleteTodo(item.todo.id);
              toast('To-do deleted');
              onClose();
            }}
          >
            Delete
          </Button>
          <Button type="submit" variant="primary" disabled={title.trim() === ''}>
            Save changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
