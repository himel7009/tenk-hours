import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input } from '../../components/Field';
import { BAD_HABIT_ICONS, DEFAULT_BAD_HABIT_ICON, type BadHabit } from '../../domain/badHabits';
import { SKILL_COLORS } from '../../domain/types';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import formStyles from '../skills/SkillFormDialog.module.css';

interface BadHabitFormDialogProps {
  /** The bad habit to edit. Omit to add a new one. */
  habit?: BadHabit;
  onClose: () => void;
}

export function BadHabitFormDialog({ habit, onClose }: BadHabitFormDialogProps) {
  const addBadHabit = useTrackerStore((state) => state.addBadHabit);
  const updateBadHabit = useTrackerStore((state) => state.updateBadHabit);
  const count = useTrackerStore((state) => state.badHabits.length);
  const toast = useToastStore((state) => state.show);

  const [name, setName] = useState(habit?.name ?? '');
  const [icon, setIcon] = useState(habit?.icon ?? DEFAULT_BAD_HABIT_ICON);
  // Rose first: it reads as "stop" without being the error red.
  const colors = ['rose', ...SKILL_COLORS.filter((c) => c !== 'rose')] as const;
  const [color, setColor] = useState(habit?.color ?? colors[count % colors.length]!);
  const [error, setError] = useState<string | null>(null);

  const icons = [...new Set([icon, ...BAD_HABIT_ICONS])];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('Name the habit you want to stay away from.');
      return;
    }
    const input = { name: trimmed, icon, color };
    if (habit) {
      updateBadHabit(habit.id, input);
      toast('Changes saved');
    } else {
      addBadHabit(input);
      toast(`Added ${trimmed}. Check in once a day.`);
    }
    onClose();
  };

  return (
    <Dialog title={habit ? 'Edit bad habit' : 'Add a bad habit'} onClose={onClose}>
      <form onSubmit={handleSubmit} className={formStyles.form} data-color={color} noValidate>
        <Field
          label="What do you want to stop?"
          hint="Each day you answer one question: did you stay away from it?"
        >
          {(id) => (
            <Input
              id={id}
              type="text"
              maxLength={40}
              placeholder="Doomscrolling, smoking, late-night snacks"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>

        <fieldset className={formStyles.icons}>
          <legend>Icon</legend>
          {icons.map((option) => (
            <label key={option} className={formStyles.iconChoice}>
              <input
                type="radio"
                name="bad-habit-icon"
                className="visually-hidden"
                aria-label={option}
                checked={icon === option}
                onChange={() => setIcon(option)}
              />
              <span aria-hidden="true">{option}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className={formStyles.colors}>
          <legend>Colour</legend>
          {colors.map((option) => (
            <label key={option} className={formStyles.swatch} data-color={option}>
              <input
                type="radio"
                name="bad-habit-color"
                className="visually-hidden"
                checked={color === option}
                onChange={() => setColor(option)}
              />
              <span className="visually-hidden">{option}</span>
            </label>
          ))}
        </fieldset>

        {error && (
          <p className={formStyles.error} role="alert">
            {error}
          </p>
        )}

        <div className={formStyles.actions}>
          <span className={formStyles.spacer} />
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {habit ? 'Save changes' : 'Add bad habit'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
