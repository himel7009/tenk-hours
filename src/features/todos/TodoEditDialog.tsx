import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input, Select } from '../../components/Field';
import {
  GENERAL,
  groupTodoTargets,
  targetKindName,
  cleanTodoUrl,
  describeDeadline,
  TODO_TITLE_MAX,
  type PlannedTodo,
} from '../../domain/todos';
import { daysBetween, type DayKey } from '../../domain/dates';
import { useToday } from '../progress/useNow';
import { DeadlinePicker } from './DeadlinePicker';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import { useTodoTargets } from '../progress/useTodos';
import formStyles from '../skills/SkillFormDialog.module.css';
import { placeOf } from './todoPlace';

/** Rename a to-do, move it to another domain or skill, or plan it for another day. */
export function TodoEditDialog({ item, onClose }: { item: PlannedTodo; onClose: () => void }) {
  const targets = useTodoTargets(item.target);
  const updateTodo = useTrackerStore((state) => state.updateTodo);
  const today = useToday();
  const deleteTodo = useTrackerStore((state) => state.deleteTodo);
  const toast = useToastStore((state) => state.show);

  const [title, setTitle] = useState(item.todo.title);
  const [targetKey, setTargetKey] = useState(item.target.key);
  // An open to-do is edited from where it shows now; a done one keeps its day.
  const [day, setDay] = useState(item.todo.done ? item.todo.day : item.due);
  const [deadline, setDeadline] = useState<DayKey | null>(item.todo.deadline ?? null);
  const [link, setLink] = useState(item.todo.url ?? '');
  const [linkError, setLinkError] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const url = cleanTodoUrl(link);
    if (url === null) {
      setLinkError(true);
      return;
    }
    const target = targets.find((t) => t.key === targetKey) ?? GENERAL;
    const moved = day !== item.due || targetKey !== item.target.key;
    updateTodo(item.todo.id, {
      title,
      ...placeOf(target),
      // Moving resets the plan; leaving it alone keeps the history of misses.
      day: moved ? day : item.todo.day,
      deadline,
      url,
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
                onChange={(event) => setTargetKey(event.target.value)}
              >
                <option value={GENERAL.key}>
                  {GENERAL.icon} {GENERAL.name}
                </option>
                {groupTodoTargets(targets, day, item.target.key).map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.targets.map((target) => (
                      <option key={target.key} value={target.key}>
                        {target.icon} {target.name}
                        {group.offRoutine ? ` (${targetKindName(target).toLowerCase()})` : ''}
                      </option>
                    ))}
                  </optgroup>
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
                onChange={(event) => {
                  setDay(event.target.value || day);
                }}
              />
            )}
          </Field>
        </div>
        <Field
          label="Link"
          hint={
            linkError
              ? 'That is not a web link. Use one that starts with https://.'
              : 'A video or page to open for it. Leave empty for none.'
          }
        >
          {(id) => (
            <Input
              id={id}
              type="url"
              inputMode="url"
              value={link}
              placeholder="https://youtube.com/watch?v=..."
              aria-invalid={linkError || undefined}
              onChange={(event) => {
                setLink(event.target.value);
                setLinkError(false);
              }}
            />
          )}
        </Field>
        <Field
          label="Deadline"
          hint={
            deadline === null
              ? 'None. It can take as long as it takes.'
              : `${describeDeadline({ daysLeft: daysBetween(today, deadline), todo: item.todo })?.text}.`
          }
        >
          {(id) => (
            <span>
              <DeadlinePicker
                id={id}
                value={deadline}
                onChange={setDeadline}
                from={item.todo.done ? item.addedDay : today}
              />
            </span>
          )}
        </Field>
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
