import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input } from '../../components/Field';
import { WeekdayPicker } from '../../components/WeekdayPicker';
import type { Weekday } from '../../domain/routine';
import { DEFAULT_DOMAIN_ICON, type Domain } from '../../domain/domains';
import { ICON_CHOICES, SKILL_COLORS } from '../../domain/types';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import formStyles from '../skills/SkillFormDialog.module.css';

const DOMAIN_ICONS = [DEFAULT_DOMAIN_ICON, '🧪', '🏗️', '💼', '🎭', '🏅', '🩺', '⚙️'];

interface DomainFormDialogProps {
  /** The domain to edit. Omit to create a new one. */
  domain?: Domain;
  onClose: () => void;
}

export function DomainFormDialog({ domain, onClose }: DomainFormDialogProps) {
  const addDomain = useTrackerStore((state) => state.addDomain);
  const updateDomain = useTrackerStore((state) => state.updateDomain);
  const deleteDomain = useTrackerStore((state) => state.deleteDomain);
  const setRoutine = useTrackerStore((state) => state.setRoutine);
  const domainCount = useTrackerStore((state) => state.domains.length);
  const skillCount = useTrackerStore(
    (state) => state.skills.filter((skill) => skill.domainId === domain?.id).length,
  );
  const toast = useToastStore((state) => state.show);

  const [name, setName] = useState(domain?.name ?? '');
  const [icon, setIcon] = useState(domain?.icon ?? DEFAULT_DOMAIN_ICON);
  const [color, setColor] = useState(
    domain?.color ?? SKILL_COLORS[domainCount % SKILL_COLORS.length]!,
  );
  const [routineDays, setRoutineDays] = useState<Weekday[]>(domain?.routineDays ?? []);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const icons = [...new Set([icon, ...DOMAIN_ICONS, ...ICON_CHOICES])].slice(0, 40);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('Give the domain a name.');
      return;
    }

    const input = { name: trimmed, icon, color };
    if (domain) {
      updateDomain(domain.id, input);
      setRoutine({ domainId: domain.id }, routineDays);
      toast('Changes saved');
    } else {
      setRoutine({ domainId: addDomain(input) }, routineDays);
      toast(`Added ${trimmed}. Now add skills to it.`);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!domain) return;
    deleteDomain(domain.id);
    toast(`Deleted ${domain.name}. Its skills were kept.`);
    onClose();
  };

  return (
    <Dialog title={domain ? 'Edit domain' : 'Add a domain'} onClose={onClose}>
      <form onSubmit={handleSubmit} className={formStyles.form} noValidate>
        <Field
          label="Name"
          hint="A field that several skills belong to. Its hours are the total of those skills."
        >
          {(id) => (
            <Input
              id={id}
              type="text"
              maxLength={40}
              placeholder="AI, music, languages"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>

        <fieldset className={formStyles.icons} data-color={color}>
          <legend>Icon</legend>
          {icons.map((option) => (
            <label key={option} className={formStyles.iconChoice}>
              <input
                type="radio"
                name="domain-icon"
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
          {SKILL_COLORS.map((option) => (
            <label key={option} className={formStyles.swatch} data-color={option}>
              <input
                type="radio"
                name="domain-color"
                className="visually-hidden"
                checked={color === option}
                onChange={() => setColor(option)}
              />
              <span className="visually-hidden">{option}</span>
            </label>
          ))}
        </fieldset>

        <WeekdayPicker
          legend="Days you study this domain"
          hint="Its skills follow these days, and days off never break a streak"
          value={routineDays}
          onChange={setRoutineDays}
        />

        {error && (
          <p className={formStyles.error} role="alert">
            {error}
          </p>
        )}

        <div className={formStyles.actions}>
          {domain &&
            (confirmingDelete ? (
              <Button variant="danger" onClick={handleDelete}>
                {skillCount > 0
                  ? `Delete domain, keep its ${skillCount} skill${skillCount === 1 ? '' : 's'}`
                  : 'Confirm delete'}
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                Delete domain
              </Button>
            ))}
          <span className={formStyles.spacer} />
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {domain ? 'Save changes' : 'Add domain'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
