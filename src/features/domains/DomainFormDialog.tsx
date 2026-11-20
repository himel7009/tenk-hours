import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input } from '../../components/Field';
import { WeekdayPicker } from '../../components/WeekdayPicker';
import type { Weekday } from '../../domain/routine';
import type { Domain } from '../../domain/domains';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import { LookPicker } from '../appearance/LookPicker';
import { useLook } from '../appearance/useLook';
import formStyles from '../skills/SkillFormDialog.module.css';

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
  const skillCount = useTrackerStore(
    (state) => state.skills.filter((skill) => skill.domainId === domain?.id).length,
  );
  const toast = useToastStore((state) => state.show);

  const [name, setName] = useState(domain?.name ?? '');
  const look = useLook({ kind: 'domain', name, current: domain, exceptId: domain?.id });
  const { icon, color } = look;
  const [routineDays, setRoutineDays] = useState<Weekday[]>(domain?.routineDays ?? []);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
      <form onSubmit={handleSubmit} className={formStyles.form} data-color={color} noValidate>
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

        <LookPicker look={look} />

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
