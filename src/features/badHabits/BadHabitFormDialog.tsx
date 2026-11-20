import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input } from '../../components/Field';
import type { BadHabit } from '../../domain/badHabits';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import { LookPicker } from '../appearance/LookPicker';
import { useLook } from '../appearance/useLook';
import formStyles from '../skills/SkillFormDialog.module.css';

interface BadHabitFormDialogProps {
  /** The bad habit to edit. Omit to add a new one. */
  habit?: BadHabit;
  onClose: () => void;
}

export function BadHabitFormDialog({ habit, onClose }: BadHabitFormDialogProps) {
  const addBadHabit = useTrackerStore((state) => state.addBadHabit);
  const updateBadHabit = useTrackerStore((state) => state.updateBadHabit);
  const toast = useToastStore((state) => state.show);

  const [name, setName] = useState(habit?.name ?? '');
  const look = useLook({ kind: 'badHabit', name, current: habit, exceptId: habit?.id });
  const { icon, color } = look;
  const [error, setError] = useState<string | null>(null);

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

        <LookPicker look={look} />

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
