import { fromDayKey } from '../../domain/dates';
import {
  dayRuns,
  formatTaka,
  tagOf,
  type MoneyEntry,
  type MoneyMonth,
  type MoneySection,
} from '../../domain/money';
import styles from './Money.module.css';

interface DayListProps {
  month: MoneyMonth;
  sections: readonly MoneySection[];
  onEdit: (entry: MoneyEntry) => void;
}

const dayTitle = (day: string) =>
  fromDayKey(day).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

/** The month day by day, like the sheet: each line, and the day's total. */
export function DayList({ month, sections, onEdit }: DayListProps) {
  const byId = new Map(sections.map((section) => [section.id, section]));
  const gaps = dayRuns(month.untracked);

  if (month.days.length === 0) {
    return (
      <p className={styles.empty}>
        Nothing written down for this month yet. Add an expense above, or import a sheet.
      </p>
    );
  }

  return (
    <div className={styles.dayList}>
      {gaps.length > 0 && (
        <p className={styles.gaps}>
          No spending written down on{' '}
          {gaps
            .map(({ from, to }) =>
              from === to
                ? fromDayKey(from).getDate()
                : `${fromDayKey(from).getDate()} to ${fromDayKey(to).getDate()}`,
            )
            .join(', ')}{' '}
          {fromDayKey(month.untracked[0]!).toLocaleDateString(undefined, { month: 'short' })}. Days
          you spent nothing count too, but gaps are often things forgotten.
        </p>
      )}
      {month.days.map(({ day, entries, spent }) => (
        <section key={day} className={styles.day} aria-label={dayTitle(day)}>
          <h3 className={styles.dayHead}>
            <span>{dayTitle(day)}</span>
            <span className="tabular">{spent > 0 ? formatTaka(spent) : ''}</span>
          </h3>
          <ul>
            {entries.map((entry) => {
              const section = byId.get(entry.sectionId);
              const target = entry.toSectionId ? byId.get(entry.toSectionId) : undefined;
              const tag = entry.kind === 'spend' ? tagOf(entry.note) : null;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={styles.entry}
                    data-kind={entry.kind}
                    data-color={section?.color}
                    onClick={() => onEdit(entry)}
                    aria-label={`Edit ${formatTaka(entry.amount)} ${entry.note || entry.kind}`}
                  >
                    <span className={styles.entryDot} aria-hidden="true" />
                    <span className={styles.entryText}>
                      <span className={styles.entryNote}>
                        {entry.kind === 'spend'
                          ? entry.note || 'No details'
                          : entry.kind === 'add'
                            ? `Added to ${section?.name ?? 'a section'}${entry.note ? `: ${entry.note}` : ''}`
                            : `Moved to ${target?.name ?? 'a section'}${entry.note ? `: ${entry.note}` : ''}`}
                      </span>
                      <span className={styles.entryMeta}>
                        {section?.icon} {section?.name}
                        {tag && tag.id !== 'other' && `, ${tag.icon} ${tag.label}`}
                      </span>
                    </span>
                    <span className={`tabular ${styles.entryAmount}`}>
                      {entry.kind === 'add' ? '+' : ''}
                      {formatTaka(entry.amount)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
