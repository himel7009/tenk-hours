import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import type { DayKey } from '../../domain/dates';
import {
  formatTaka,
  MONEY_NOTE_MAX,
  parseAmount,
  parseQuickEntry,
  tagOf,
  type MoneyEntryKind,
  type MoneySectionId,
} from '../../domain/money';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import styles from './Money.module.css';

const KINDS: { kind: MoneyEntryKind; label: string }[] = [
  { kind: 'spend', label: 'Spent' },
  { kind: 'add', label: 'Add money' },
  { kind: 'move', label: 'Move money' },
];

/**
 * One line, the way it goes in a notebook: "130 bus". Pick the section and
 * the day, and it is written down.
 */
export function QuickAdd({ today, initialText = '' }: { today: DayKey; initialText?: string }) {
  const sections = useTrackerStore((state) => state.moneySections);
  const addMoneyEntry = useTrackerStore((state) => state.addMoneyEntry);
  const toast = useToastStore((state) => state.show);

  const [kind, setKind] = useState<MoneyEntryKind>('spend');
  const [text, setText] = useState(initialText);
  const [sectionId, setSectionId] = useState<MoneySectionId>(sections[0]?.id ?? '');
  const [toSectionId, setToSectionId] = useState<MoneySectionId>(sections[1]?.id ?? '');
  const [day, setDay] = useState<DayKey>(today);
  const [error, setError] = useState<string | null>(null);

  // A section deleted elsewhere falls back to the first one.
  const from = sections.some((s) => s.id === sectionId) ? sectionId : (sections[0]?.id ?? '');
  const to = sections.some((s) => s.id === toSectionId && s.id !== from)
    ? toSectionId
    : (sections.find((s) => s.id !== from)?.id ?? '');

  // "130 bus" gives both; a bare "130" is fine for adding or moving money.
  const parsed =
    parseQuickEntry(text) ??
    (() => {
      const amount = parseAmount(text);
      return amount === null ? null : { amount, note: '' };
    })();
  const tag = kind === 'spend' && parsed?.note ? tagOf(parsed.note) : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!parsed) {
      setError('Start or end with an amount, such as "130 bus".');
      return;
    }
    if (kind === 'move' && !to) {
      setError('Add a second section to move money into.');
      return;
    }
    addMoneyEntry({
      sectionId: from,
      kind,
      toSectionId: kind === 'move' ? to : null,
      day,
      amount: parsed.amount,
      note: parsed.note,
    });
    const name = (id: string) => sections.find((s) => s.id === id)?.name ?? '';
    toast(
      kind === 'spend'
        ? `${formatTaka(parsed.amount)} spent from ${name(from)}`
        : kind === 'add'
          ? `${formatTaka(parsed.amount)} added to ${name(from)}`
          : `${formatTaka(parsed.amount)} moved from ${name(from)} to ${name(to)}`,
    );
    setText('');
    setError(null);
  };

  return (
    <form className={styles.quick} onSubmit={submit} aria-label="Write down money">
      <div className={styles.kinds} role="radiogroup" aria-label="What happened">
        {KINDS.map((option) => (
          <label key={option.kind}>
            <input
              type="radio"
              name="money-kind"
              className="visually-hidden"
              checked={kind === option.kind}
              onChange={() => setKind(option.kind)}
            />
            {option.label}
          </label>
        ))}
      </div>

      <div className={styles.quickLine}>
        <label htmlFor="money-text" className="visually-hidden">
          Amount and what it was for
        </label>
        <input
          // Arriving from the calculator, carry on typing what it was for.
          autoFocus={initialText !== ''}
          id="money-text"
          className={styles.quickInput}
          value={text}
          maxLength={MONEY_NOTE_MAX + 20}
          autoComplete="off"
          placeholder={
            kind === 'spend'
              ? '130 bus'
              : kind === 'add'
                ? '4000 monthly allowance'
                : '1000 for meal'
          }
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
        />
        <Button type="submit" variant="primary" disabled={text.trim() === ''}>
          {kind === 'spend' ? 'Save expense' : kind === 'add' ? 'Add money' : 'Move money'}
        </Button>
      </div>

      <div className={styles.quickMeta}>
        <span
          className={styles.chips}
          role="radiogroup"
          aria-label={kind === 'move' ? 'From' : 'Section'}
        >
          {kind === 'move' && <span className={styles.chipLabel}>From</span>}
          {sections.map((section) => (
            <label key={section.id} className={styles.chip} data-color={section.color}>
              <input
                type="radio"
                name="money-section"
                className="visually-hidden"
                checked={from === section.id}
                onChange={() => setSectionId(section.id)}
              />
              <span aria-hidden="true">{section.icon}</span> {section.name}
            </label>
          ))}
        </span>
        {kind === 'move' && (
          <span className={styles.chips} role="radiogroup" aria-label="To">
            <span className={styles.chipLabel}>To</span>
            {sections
              .filter((section) => section.id !== from)
              .map((section) => (
                <label key={section.id} className={styles.chip} data-color={section.color}>
                  <input
                    type="radio"
                    name="money-to"
                    className="visually-hidden"
                    checked={to === section.id}
                    onChange={() => setToSectionId(section.id)}
                  />
                  <span aria-hidden="true">{section.icon}</span> {section.name}
                </label>
              ))}
          </span>
        )}
        <label className={styles.date}>
          <span className="visually-hidden">Day</span>
          <input
            type="date"
            value={day}
            max={today}
            onChange={(event) => setDay(event.target.value || today)}
          />
        </label>
      </div>

      <p className={styles.quickHint} role={error ? 'alert' : undefined}>
        {error ??
          (parsed
            ? `${formatTaka(parsed.amount)}${parsed.note ? ` for ${parsed.note}` : ''}${tag ? `, ${tag.icon} ${tag.label}` : ''}`
            : 'Type the amount and what it was for, in either order.')}
      </p>
    </form>
  );
}
