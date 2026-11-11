import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input } from '../../components/Field';
import { DEFAULT_TARGET_HOURS, SKILL_COLORS, type Skill } from '../../domain/types';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import styles from './SkillFormDialog.module.css';

const MAX_TARGET_HOURS = 100_000;

interface SkillFormDialogProps {
  /** The skill to edit. Omit to create a new one. */
  skill?: Skill;
  onClose: () => void;
}

export function SkillFormDialog({ skill, onClose }: SkillFormDialogProps) {
  const navigate = useNavigate();
  const addSkill = useTrackerStore((state) => state.addSkill);
  const updateSkill = useTrackerStore((state) => state.updateSkill);
  const deleteSkill = useTrackerStore((state) => state.deleteSkill);
  const skillCount = useTrackerStore((state) => state.skills.length);
  const sessionCount = useTrackerStore(
    (state) => state.sessions.filter((session) => session.skillId === skill?.id).length,
  );
  const toast = useToastStore((state) => state.show);

  const [name, setName] = useState(skill?.name ?? '');
  const [color, setColor] = useState(
    skill?.color ?? SKILL_COLORS[skillCount % SKILL_COLORS.length]!,
  );
  const [target, setTarget] = useState(String(skill?.targetHours ?? DEFAULT_TARGET_HOURS));
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    const targetHours = Number(target);

    if (trimmed === '') {
      setError('Give the skill a name.');
      return;
    }
    if (!Number.isInteger(targetHours) || targetHours < 1 || targetHours > MAX_TARGET_HOURS) {
      setError(`Set a target between 1 and ${MAX_TARGET_HOURS.toLocaleString()} hours.`);
      return;
    }

    const input = { name: trimmed, color, targetHours };
    if (skill) {
      updateSkill(skill.id, input);
      toast('Skill updated');
    } else {
      void navigate(`/skills/${addSkill(input)}`);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!skill) return;
    deleteSkill(skill.id);
    toast(`Deleted ${skill.name}`);
    void navigate('/');
  };

  return (
    <Dialog title={skill ? 'Edit skill' : 'Add a skill'} onClose={onClose}>
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <Field label="Name">
          {(id) => (
            <Input
              id={id}
              type="text"
              maxLength={40}
              placeholder="Python, drawing, deep learning"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>

        <fieldset className={styles.colors}>
          <legend>Colour</legend>
          {SKILL_COLORS.map((option) => (
            <label key={option} className={styles.swatch} data-color={option}>
              <input
                type="radio"
                name="color"
                className="visually-hidden"
                checked={color === option}
                onChange={() => setColor(option)}
              />
              <span className="visually-hidden">{option}</span>
            </label>
          ))}
        </fieldset>

        <Field label="Target hours" hint="10,000 is the classic figure. Pick what suits the skill.">
          {(id) => (
            <Input
              id={id}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_TARGET_HOURS}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          )}
        </Field>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          {skill &&
            (confirmingDelete ? (
              <Button variant="danger" onClick={handleDelete}>
                {sessionCount > 0
                  ? `Delete skill and ${sessionCount} session${sessionCount === 1 ? '' : 's'}`
                  : 'Confirm delete'}
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                Delete skill
              </Button>
            ))}
          <span className={styles.spacer} />
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {skill ? 'Save changes' : 'Add skill'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
