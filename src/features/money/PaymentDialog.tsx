import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input, Select } from '../../components/Field';
import type { DayKey } from '../../domain/dates';
import type { DebtSummary } from '../../domain/debts';
import { formatTaka, MONEY_NOTE_MAX, parseAmount } from '../../domain/money';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import formStyles from '../skills/SkillFormDialog.module.css';
import styles from './Money.module.css';

/** Record a payment on a debt, whole or part, and the section it went through. */
export function PaymentDialog({
  summary,
  today,
  onClose,
}: {
  summary: DebtSummary;
  today: DayKey;
  onClose: () => void;
}) {
  const sections = useTrackerStore((state) => state.moneySections);
  const addDebtPayment = useTrackerStore((state) => state.addDebtPayment);
  const deleteDebtPayment = useTrackerStore((state) => state.deleteDebtPayment);
  const toast = useToastStore((state) => state.show);
  const { debt, left } = summary;
  const borrowed = debt.direction === 'borrowed';

  const [amount, setAmount] = useState(String(left / 100));
  const [day, setDay] = useState<DayKey>(today);
  const [sectionId, setSectionId] = useState(debt.sectionId ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const paisa = parseAmount(amount);
    if (paisa === null) return setError('Enter an amount above zero.');
    if (paisa > left) return setError(`Only ${formatTaka(left)} is left on this debt.`);
    addDebtPayment({
      debtId: debt.id,
      day,
      amount: paisa,
      sectionId: sectionId === '' ? null : sectionId,
      note,
    });
    toast(
      paisa === left
        ? `Settled with ${debt.person}`
        : `${formatTaka(paisa)} ${borrowed ? 'paid to' : 'received from'} ${debt.person}. ${formatTaka(left - paisa)} left.`,
    );
    onClose();
  };

  return (
    <Dialog
      title={borrowed ? `Pay back ${debt.person}` : `Money back from ${debt.person}`}
      onClose={onClose}
    >
      <form className={formStyles.form} onSubmit={submit} noValidate>
        <p className={formStyles.hint}>
          {formatTaka(left)} left of {formatTaka(debt.amount)}. Part payments are fine.
        </p>
        <div className={formStyles.numbers}>
          <Field label="Amount, taka">
            {(id) => (
              <Input
                id={id}
                inputMode="decimal"
                value={amount}
                autoFocus
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
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
        <Field label={borrowed ? 'Paid from' : 'Put into'}>
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
        <Field label="Note">
          {(id) => (
            <Input
              id={id}
              value={note}
              maxLength={MONEY_NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
        {error && (
          <p className={formStyles.error} role="alert">
            {error}
          </p>
        )}

        {summary.payments.length > 0 && (
          <div className={styles.paymentList}>
            <h3>Payments so far</h3>
            <ul>
              {summary.payments.map((payment) => (
                <li key={payment.id}>
                  <span className="tabular">{payment.day}</span>
                  <span>{payment.note}</span>
                  <span className="tabular">{formatTaka(payment.amount)}</span>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => {
                      deleteDebtPayment(payment.id);
                      toast('Payment deleted');
                      onClose();
                    }}
                    aria-label={`Delete the ${formatTaka(payment.amount)} payment`}
                    title="Delete payment"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={formStyles.actions}>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {borrowed ? 'Save payment' : 'Save money received'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
