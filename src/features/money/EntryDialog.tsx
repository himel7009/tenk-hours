import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input, Select } from '../../components/Field';
import type { DayKey } from '../../domain/dates';
import {
  MONEY_NOTE_MAX,
  parseAmount,
  type MoneyEntry,
  type MoneyEntryKind,
} from '../../domain/money';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import formStyles from '../skills/SkillFormDialog.module.css';

/** Change or delete one line of money. */
export function EntryDialog({ entry, onClose }: { entry: MoneyEntry; onClose: () => void }) {
  const sections = useTrackerStore((state) => state.moneySections);
  const updateMoneyEntry = useTrackerStore((state) => state.updateMoneyEntry);
  const deleteMoneyEntry = useTrackerStore((state) => state.deleteMoneyEntry);
  const toast = useToastStore((state) => state.show);

  const [kind, setKind] = useState<MoneyEntryKind>(entry.kind);
  const [amount, setAmount] = useState(String(entry.amount / 100));
  const [note, setNote] = useState(entry.note);
  const [sectionId, setSectionId] = useState(entry.sectionId);
  const [toSectionId, setToSectionId] = useState(
    entry.toSectionId ?? sections.find((s) => s.id !== entry.sectionId)?.id ?? '',
  );
  const [day, setDay] = useState<DayKey>(entry.day);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const paisa = parseAmount(amount);
    if (paisa === null) return setError('Enter an amount above zero.');
    if (kind === 'move' && (!toSectionId || toSectionId === sectionId)) {
      return setError('Pick a different section to move the money to.');
    }
    updateMoneyEntry(entry.id, {
      kind,
      amount: paisa,
      note,
      sectionId,
      toSectionId: kind === 'move' ? toSectionId : null,
      day,
    });
    toast('Changes saved');
    onClose();
  };

  return (
    <Dialog title="Edit entry" onClose={onClose}>
      <form className={formStyles.form} onSubmit={submit} noValidate>
        <Field label="What happened">
          {(id) => (
            <Select
              id={id}
              value={kind}
              onChange={(e) => setKind(e.target.value as MoneyEntryKind)}
            >
              <option value="spend">Spent</option>
              <option value="add">Added money</option>
              <option value="move">Moved money</option>
            </Select>
          )}
        </Field>
        <div className={formStyles.numbers}>
          <Field label="Amount, taka">
            {(id) => (
              <Input
                id={id}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            )}
          </Field>
          <Field label="Day">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value || day)}
              />
            )}
          </Field>
        </div>
        <Field label="Details">
          {(id) => (
            <Input
              id={id}
              value={note}
              maxLength={MONEY_NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
        <div className={formStyles.numbers}>
          <Field label={kind === 'move' ? 'From' : 'Section'}>
            {(id) => (
              <Select id={id} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.icon} {section.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {kind === 'move' && (
            <Field label="To">
              {(id) => (
                <Select
                  id={id}
                  value={toSectionId}
                  onChange={(e) => setToSectionId(e.target.value)}
                >
                  {sections
                    .filter((section) => section.id !== sectionId)
                    .map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.icon} {section.name}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
          )}
        </div>
        {error && (
          <p className={formStyles.error} role="alert">
            {error}
          </p>
        )}
        <div className={formStyles.actions}>
          {confirming ? (
            <Button
              variant="danger"
              onClick={() => {
                deleteMoneyEntry(entry.id);
                toast('Entry deleted');
                onClose();
              }}
            >
              Delete this entry
            </Button>
          ) : (
            <Button variant="quiet" onClick={() => setConfirming(true)}>
              Delete
            </Button>
          )}
          <Button type="submit" variant="primary">
            Save changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
