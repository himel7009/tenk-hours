import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input } from '../../components/Field';
import { Toggle } from '../../components/Toggle';
import type { MoneySection } from '../../domain/money';
import { SKILL_COLORS, type SkillColor } from '../../domain/types';
import { useToastStore } from '../../store/toastStore';
import { suggestSectionIcon, useTrackerStore } from '../../store/trackerStore';
import formStyles from '../skills/SkillFormDialog.module.css';
import styles from './Money.module.css';

/** Add or change a section: its name, look, and whether it carries over. */
export function SectionDialog({
  section,
  onClose,
}: {
  section: MoneySection | null;
  onClose: () => void;
}) {
  const sections = useTrackerStore((state) => state.moneySections);
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
  const [icon, setIcon] = useState(section?.icon ?? '');
  const [color, setColor] = useState<SkillColor>(
    section?.color ?? SKILL_COLORS[sections.length % SKILL_COLORS.length]!,
  );
  const [carryOver, setCarryOver] = useState(section?.carryOver ?? false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = name.trim().slice(0, 60);
    if (clean === '') return setError('Give the section a name.');
    const input = { name: clean, icon: icon.trim() || suggestSectionIcon(clean), color, carryOver };
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
      <form className={formStyles.form} onSubmit={submit} noValidate>
        <div className={formStyles.numbers}>
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
          <Field label="Icon" hint="One emoji.">
            {(id) => (
              <Input
                id={id}
                value={icon}
                maxLength={16}
                placeholder={suggestSectionIcon(name)}
                onChange={(e) => setIcon(e.target.value)}
              />
            )}
          </Field>
        </div>
        <fieldset className={styles.colors}>
          <legend>Colour</legend>
          {SKILL_COLORS.map((option) => (
            <label key={option} data-color={option} title={option}>
              <input
                type="radio"
                name="section-color"
                className="visually-hidden"
                checked={color === option}
                onChange={() => setColor(option)}
              />
              <span className="visually-hidden">{option}</span>
            </label>
          ))}
        </fieldset>
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
