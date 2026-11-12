import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input } from '../../components/Field';
import {
  DEFAULT_DAILY_GOAL_MINUTES,
  DEFAULT_ICONS,
  DEFAULT_TARGET_HOURS,
  ICON_CHOICES,
  SKILL_COLORS,
  type Skill,
  type TrackerKind,
} from '../../domain/types';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import styles from './SkillFormDialog.module.css';

const MAX_TARGET_HOURS = 100_000;
const MAX_DAILY_GOAL_MINUTES = 24 * 60;

const COPY: Record<TrackerKind, { noun: string; add: string; placeholder: string }> = {
  skill: { noun: 'skill', add: 'Add a skill', placeholder: 'Python, drawing, deep learning' },
  habit: { noun: 'habit', add: 'Add a habit', placeholder: 'Reading, exercise, meditation' },
};

type SkillFormDialogProps = { onClose: () => void } & (
  | { /** The skill or habit to edit. */ skill: Skill; kind?: never }
  | { /** What to create. */ kind: TrackerKind; skill?: never }
);

export function SkillFormDialog(props: SkillFormDialogProps) {
  const { skill, onClose } = props;
  const kind = props.skill ? props.skill.kind : props.kind;
  const { noun, add, placeholder } = COPY[kind];

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
  const [icon, setIcon] = useState(skill?.icon ?? DEFAULT_ICONS[kind]);
  const [color, setColor] = useState(
    skill?.color ?? SKILL_COLORS[skillCount % SKILL_COLORS.length]!,
  );
  const [target, setTarget] = useState(String(skill?.targetHours ?? DEFAULT_TARGET_HOURS));
  const [dailyGoal, setDailyGoal] = useState(
    String(skill?.dailyGoalMinutes ?? DEFAULT_DAILY_GOAL_MINUTES),
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // An icon saved earlier may not be in today's list; keep it selectable.
  const icons = ICON_CHOICES.includes(icon as (typeof ICON_CHOICES)[number])
    ? ICON_CHOICES
    : [icon, ...ICON_CHOICES];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    const targetHours = Number(target);
    const dailyGoalMinutes = Number(dailyGoal);

    if (trimmed === '') {
      setError(`Give the ${noun} a name.`);
      return;
    }
    if (
      kind === 'skill' &&
      (!Number.isInteger(targetHours) || targetHours < 1 || targetHours > MAX_TARGET_HOURS)
    ) {
      setError(`Set a target between 1 and ${MAX_TARGET_HOURS.toLocaleString()} hours.`);
      return;
    }
    if (
      !Number.isInteger(dailyGoalMinutes) ||
      dailyGoalMinutes < 1 ||
      dailyGoalMinutes > MAX_DAILY_GOAL_MINUTES
    ) {
      setError('Set a daily goal between 1 and 1,440 minutes.');
      return;
    }

    const input = { name: trimmed, icon, color, targetHours, dailyGoalMinutes };
    if (skill) {
      updateSkill(skill.id, input);
      toast('Changes saved');
    } else {
      void navigate(`/skills/${addSkill(kind, input)}`);
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
    <Dialog title={skill ? `Edit ${noun}` : add} onClose={onClose}>
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <Field label="Name">
          {(id) => (
            <Input
              id={id}
              type="text"
              maxLength={40}
              placeholder={placeholder}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>

        <fieldset className={styles.icons} data-color={color}>
          <legend>Icon</legend>
          {icons.map((option) => (
            <label key={option} className={styles.iconChoice}>
              <input
                type="radio"
                name="icon"
                className="visually-hidden"
                aria-label={option}
                checked={icon === option}
                onChange={() => setIcon(option)}
              />
              <span aria-hidden="true">{option}</span>
            </label>
          ))}
        </fieldset>

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

        <div className={styles.numbers}>
          <Field
            label="Daily goal, minutes"
            hint="A day counts towards your streak once you reach this."
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_DAILY_GOAL_MINUTES}
                value={dailyGoal}
                onChange={(event) => setDailyGoal(event.target.value)}
              />
            )}
          </Field>

          {kind === 'skill' && (
            <Field label="Target hours" hint="10,000 is the classic figure.">
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
          )}
        </div>

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
                  ? `Delete ${noun} and ${sessionCount} session${sessionCount === 1 ? '' : 's'}`
                  : 'Confirm delete'}
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                Delete {noun}
              </Button>
            ))}
          <span className={styles.spacer} />
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {skill ? 'Save changes' : `Add ${noun}`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
