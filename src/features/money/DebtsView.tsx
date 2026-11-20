import { useState } from 'react';
import { Button } from '../../components/Button';
import { fromDayKey, type DayKey } from '../../domain/dates';
import { describeDue, type DebtDirection, type DebtSummary } from '../../domain/debts';
import { formatTaka } from '../../domain/money';
import { useTrackerStore } from '../../store/trackerStore';
import { useDebtBook } from '../progress/useMoney';
import { DebtDialog } from './DebtDialog';
import styles from './Money.module.css';
import { PaymentDialog } from './PaymentDialog';

type DialogState =
  | { type: 'debt'; summary: DebtSummary | null; direction: DebtDirection }
  | { type: 'pay'; summary: DebtSummary }
  | null;

const shortDay = (day: DayKey) =>
  fromDayKey(day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** Who you owe and who owes you, with deadlines and part payments. */
export function DebtsView({ today }: { today: DayKey }) {
  const book = useDebtBook();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [showSettled, setShowSettled] = useState(false);

  return (
    <div className={styles.debts}>
      <div className={styles.debtTotals}>
        <section className={styles.debtTotal} data-direction="borrowed">
          <p>You owe</p>
          <p className={`tabular ${styles.debtFigure}`}>{formatTaka(book.oweTotal)}</p>
          <p className={styles.debtSub}>
            {book.owe.length === 0
              ? 'Nothing owed. Good.'
              : `to ${book.owe.length} ${book.owe.length === 1 ? 'person' : 'people'}`}
          </p>
          <Button
            size="sm"
            onClick={() => setDialog({ type: 'debt', summary: null, direction: 'borrowed' })}
          >
            I borrowed money
          </Button>
        </section>
        <section className={styles.debtTotal} data-direction="lent">
          <p>Owed to you</p>
          <p className={`tabular ${styles.debtFigure}`}>{formatTaka(book.owedTotal)}</p>
          <p className={styles.debtSub}>
            {book.owed.length === 0
              ? 'Nobody owes you anything.'
              : `by ${book.owed.length} ${book.owed.length === 1 ? 'person' : 'people'}`}
          </p>
          <Button
            size="sm"
            onClick={() => setDialog({ type: 'debt', summary: null, direction: 'lent' })}
          >
            I lent money
          </Button>
        </section>
      </div>

      <DebtList
        title="You owe"
        empty="Nothing to pay back."
        items={book.owe}
        onEdit={(summary) => setDialog({ type: 'debt', summary, direction: 'borrowed' })}
        onPay={(summary) => setDialog({ type: 'pay', summary })}
      />
      <DebtList
        title="Owed to you"
        empty="Nobody owes you anything."
        items={book.owed}
        onEdit={(summary) => setDialog({ type: 'debt', summary, direction: 'lent' })}
        onPay={(summary) => setDialog({ type: 'pay', summary })}
      />

      {book.settled.length > 0 && (
        <section>
          <button
            type="button"
            className={styles.foldToggle}
            aria-expanded={showSettled}
            onClick={() => setShowSettled(!showSettled)}
          >
            Settled <span className="tabular">{book.settled.length}</span>
          </button>
          {showSettled && (
            <ul className={styles.debtList}>
              {book.settled.map((summary) => (
                <DebtCard
                  key={summary.debt.id}
                  summary={summary}
                  onEdit={() =>
                    setDialog({ type: 'debt', summary, direction: summary.debt.direction })
                  }
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {dialog?.type === 'debt' && (
        <DebtDialog
          debt={dialog.summary?.debt ?? null}
          direction={dialog.direction}
          today={today}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'pay' && (
        <PaymentDialog summary={dialog.summary} today={today} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function DebtList({
  title,
  empty,
  items,
  onEdit,
  onPay,
}: {
  title: string;
  empty: string;
  items: DebtSummary[];
  onEdit: (summary: DebtSummary) => void;
  onPay: (summary: DebtSummary) => void;
}) {
  return (
    <section aria-label={title}>
      <h2 className={styles.debtHeading}>{title}</h2>
      {items.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <ul className={styles.debtList}>
          {items.map((summary) => (
            <DebtCard
              key={summary.debt.id}
              summary={summary}
              onEdit={() => onEdit(summary)}
              onPay={() => onPay(summary)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DebtCard({
  summary,
  onEdit,
  onPay,
}: {
  summary: DebtSummary;
  onEdit: () => void;
  onPay?: () => void;
}) {
  const section = useTrackerStore((state) =>
    state.moneySections.find((s) => s.id === summary.debt.sectionId),
  );
  const { debt, paid, left, status } = summary;
  const borrowed = debt.direction === 'borrowed';

  return (
    <li className={styles.debtCard} data-status={status} data-color={section?.color}>
      <div className={styles.debtTop}>
        <div>
          <h3 className={styles.debtPerson}>{debt.person}</h3>
          <p className={styles.debtSub}>
            {borrowed ? 'Borrowed' : 'Lent'} {shortDay(debt.day)}
            {section && `, ${borrowed ? 'into' : 'from'} ${section.icon} ${section.name}`}
          </p>
        </div>
        <span className={styles.due} data-status={status}>
          {describeDue(summary)}
          {debt.dueDay && status !== 'settled' && (
            <span className={styles.dueDate}>{shortDay(debt.dueDay)}</span>
          )}
        </span>
      </div>
      <p className="tabular">
        <strong className={styles.debtLeft}>
          {formatTaka(status === 'settled' ? debt.amount : left)}
        </strong>{' '}
        {status === 'settled'
          ? `settled ${summary.settledOn ? shortDay(summary.settledOn) : ''}`
          : `left of ${formatTaka(debt.amount)}`}
      </p>
      {paid > 0 && status !== 'settled' && (
        <div className={styles.meter} aria-hidden="true">
          <span style={{ width: `${(paid / debt.amount) * 100}%` }} />
        </div>
      )}
      {debt.note && <p className={styles.debtNote}>{debt.note}</p>}
      <div className={styles.debtActions}>
        {onPay && (
          <Button size="sm" variant="primary" onClick={onPay}>
            {borrowed ? 'Record a payment' : 'Record money back'}
          </Button>
        )}
        <Button size="sm" variant="quiet" onClick={onEdit}>
          Edit
        </Button>
      </div>
    </li>
  );
}
