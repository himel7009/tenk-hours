import { useState, type FormEvent } from 'react';
import { Toggle } from '../../components/Toggle';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input, Select, Textarea } from '../../components/Field';
import type { DayKey } from '../../domain/dates';
import { DEBT_PERSON_MAX, type Debt, type DebtDirection } from '../../domain/debts';
import { formatTaka, MONEY_NOTE_MAX, parseAmount } from '../../domain/money';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import formStyles from '../skills/SkillFormDialog.module.css';
import styles from './Money.module.css';

/** Write down money borrowed or lent: who, how much, by when, and which section it touched. */
export function DebtDialog({
  debt,
  direction: initialDirection,
  today,
  onClose,
}: {
  debt: Debt | null;
  direction: DebtDirection;
  today: DayKey;
  onClose: () => void;
}) {
  const sections = useTrackerStore((state) => state.moneySections);
  const paymentCount = useTrackerStore(
    (state) => state.debtPayments.filter((p) => debt && p.debtId === debt.id).length,
  );
  const addDebt = useTrackerStore((state) => state.addDebt);
  const updateDebt = useTrackerStore((state) => state.updateDebt);
  const deleteDebt = useTrackerStore((state) => state.deleteDebt);
  const toast = useToastStore((state) => state.show);

  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? initialDirection);
  const [person, setPerson] = useState(debt?.person ?? '');
  const [amount, setAmount] = useState(debt ? String(debt.amount / 100) : '');
  const [day, setDay] = useState<DayKey>(debt?.day ?? today);
  const [dueDay, setDueDay] = useState<DayKey | ''>(debt?.dueDay ?? '');
  const [sectionId, setSectionId] = useState(debt?.sectionId ?? '');
  const [inBudget, setInBudget] = useState(debt?.inBudget ?? false);
  const [note, setNote] = useState(debt?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const borrowed = direction === 'borrowed';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const paisa = parseAmount(amount);
    if (person.trim() === '') return setError('Who is it with?');
    if (paisa === null) return setError('Enter an amount above zero.');
    if (dueDay !== '' && dueDay < day)
      return setError('The deadline cannot be before the day it started.');
    const input = {
      direction,
      person,
      amount: paisa,
      day,
      dueDay: dueDay === '' ? null : dueDay,
      sectionId: sectionId === '' ? null : sectionId,
      inBudget: sectionId !== '' && inBudget,
      note,
    };
    if (debt) {
      updateDebt(debt.id, input);
      toast('Changes saved');
    } else {
      addDebt(input);
      toast(
        borrowed
          ? `You owe ${person.trim()} ${formatTaka(paisa)}`
          : `${person.trim()} owes you ${formatTaka(paisa)}`,
      );
    }
    onClose();
  };

  return (
    <Dialog
      title={debt ? 'Edit debt' : borrowed ? 'Money you borrowed' : 'Money you lent'}
      onClose={onClose}
    >
      <form className={formStyles.form} onSubmit={submit} noValidate>
        <fieldset className={styles.directions}>
          <legend className="visually-hidden">Which way</legend>
          <label>
            <input
              type="radio"
              name="debt-direction"
              className="visually-hidden"
              checked={borrowed}
              onChange={() => setDirection('borrowed')}
            />
            I borrowed
          </label>
          <label>
            <input
              type="radio"
              name="debt-direction"
              className="visually-hidden"
              checked={!borrowed}
              onChange={() => setDirection('lent')}
            />
            I lent
          </label>
        </fieldset>
        <div className={formStyles.numbers}>
          <Field label={borrowed ? 'From whom' : 'To whom'}>
            {(id) => (
              <Input
                id={id}
                value={person}
                maxLength={DEBT_PERSON_MAX}
                autoFocus
                onChange={(event) => {
                  setPerson(event.target.value);
                  setError(null);
                }}
              />
            )}
          </Field>
          <Field label="Amount, taka">
            {(id) => (
              <Input
                id={id}
                inputMode="decimal"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError(null);
                }}
              />
            )}
          </Field>
        </div>
        <div className={formStyles.numbers}>
          <Field label={borrowed ? 'Borrowed on' : 'Lent on'}>
            {(id) => (
              <Input
                id={id}
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value || day)}
              />
            )}
          </Field>
          <Field
            label={borrowed ? 'Pay back by' : 'Get back by'}
            hint="Leave empty for no deadline."
          >
            {(id) => (
              <Input
                id={id}
                type="date"
                value={dueDay}
                min={day}
                onChange={(e) => setDueDay(e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field
          label={borrowed ? 'Where the money went' : 'Where the money came from'}
          hint="For your records. It never counts as spending."
        >
          {(id) => (
            <Select id={id} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">Not through a section</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.icon} {section.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {sectionId !== '' && (
          <Toggle
            label={
              borrowed ? "Add it to the section's budget" : "Take it out of the section's budget"
            }
            hint={
              inBudget
                ? borrowed
                  ? 'The section has this much more to spend, and payments you make take it back out.'
                  : 'The section has this much less, and what is paid back goes back in.'
                : 'Leave this off when the money is already in the budget you wrote down, so it is not counted twice.'
            }
            checked={inBudget}
            onChange={setInBudget}
          />
        )}
        <Field label="Note">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={note}
              maxLength={MONEY_NOTE_MAX}
              placeholder={borrowed ? 'For the meal bazar' : 'For his bus fare home'}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
        {error && (
          <p className={formStyles.error} role="alert">
            {error}
          </p>
        )}
        <div className={formStyles.actions}>
          {debt &&
            (confirming ? (
              <Button
                variant="danger"
                onClick={() => {
                  deleteDebt(debt.id);
                  toast('Debt deleted');
                  onClose();
                }}
              >
                Delete it
                {paymentCount > 0 && ` and ${paymentCount} payment${paymentCount === 1 ? '' : 's'}`}
              </Button>
            ) : (
              <Button variant="quiet" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            ))}
          <Button type="submit" variant="primary">
            {debt ? 'Save changes' : 'Save debt'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
