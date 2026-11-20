import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input } from '../../components/Field';
import { Toggle } from '../../components/Toggle';
import type { MoneySection } from '../../domain/money';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import { LookPicker } from '../appearance/LookPicker';
import { useLook } from '../appearance/useLook';
import formStyles from '../skills/SkillFormDialog.module.css';

/** Add or change a section: its name, look, and whether it carries over. */
export function SectionDialog({
  section,
  onClose,
}: {
  section: MoneySection | null;
  onClose: () => void;
}) {
  const entryCount = useTrackerStore(
    (state) =>
      state.moneyEntries.filter(
        (entry) => section && (entry.sectionId === section.id || entry.toSectionId === section.id),
      ).length,
  );
  const addMoneySection = useTrackerStore((state) => state.addMoneySection);
  const updateMoneySection = useTrackerStore((state) => state.updateMoneySection);
  const deleteMoneySection = useTrackerStore((state) => state.deleteMoneySection);
  const toast = useToastStore((state) => state.show);

  const [name, setName] = useState(section?.name ?? '');
  const look = useLook({
    kind: 'section',
    name,
    current: section ?? undefined,
    exceptId: section?.id,
  });
  const { icon, color } = look;
  const [carryOver, setCarryOver] = useState(section?.carryOver ?? false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = name.trim().slice(0, 60);
    if (clean === '') return setError('Give the section a name.');
    const input = { name: clean, icon, color, carryOver };
    if (section) {
      updateMoneySection(section.id, input);
      toast('Changes saved');
    } else {
      addMoneySection(input);
      toast(`${clean} added`);
    }
    onClose();
  };

  return (
    <Dialog title={section ? `Edit ${section.name}` : 'Add a section'} onClose={onClose}>
      <form className={formStyles.form} onSubmit={submit} data-color={color} noValidate>
        <Field label="Name" hint="Such as Personal expense, Meal or Fund.">
          {(id) => (
            <Input
              id={id}
              value={name}
              maxLength={60}
              autoFocus
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          )}
        </Field>
        <LookPicker look={look} />
        <Toggle
          label="Carry over to next month"
          checked={carryOver}
          onChange={setCarryOver}
          hint={
            carryOver
              ? 'What is left, or overspent, rolls into next month. Good for a fund or savings.'
              : 'Every month starts fresh from the money you add. Good for monthly allowances.'
          }
        />
        {error && (
          <p className={formStyles.error} role="alert">
            {error}
          </p>
        )}
        <div className={formStyles.actions}>
          {section &&
            (confirming ? (
              <Button
                variant="danger"
                onClick={() => {
                  deleteMoneySection(section.id);
                  toast(`${section.name} deleted`);
                  onClose();
                }}
              >
                Delete {section.name}
                {entryCount > 0 && ` and ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`}
              </Button>
            ) : (
              <Button variant="quiet" onClick={() => setConfirming(true)}>
                Delete section
              </Button>
            ))}
          <Button type="submit" variant="primary">
            {section ? 'Save changes' : 'Add section'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
