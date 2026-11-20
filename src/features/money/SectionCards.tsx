import { fromDayKey } from '../../domain/dates';
import { formatTaka, type MoneyMonth, type MoneySection } from '../../domain/money';
import styles from './Money.module.css';

interface SectionCardsProps {
  month: MoneyMonth;
  onEdit: (section: MoneySection) => void;
}

const shortDate = (day: string) =>
  fromDayKey(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Each section's month: what is left, how much went, and how to pace the rest. */
export function SectionCards({ month, onEdit }: SectionCardsProps) {
  return (
    <ul className={styles.sections}>
      {month.sections.map((row) => {
        const { section, budget, spent, remaining } = row;
        const share = budget > 0 ? Math.min(1, spent / budget) : spent > 0 ? 1 : 0;
        const over = remaining < 0;
        return (
          <li
            key={section.id}
            className={styles.section}
            data-color={section.color}
            data-over={over}
          >
            <div className={styles.sectionHead}>
              <span className={styles.sectionIcon} aria-hidden="true">
                {section.icon}
              </span>
              <h3 className={styles.sectionName}>{section.name}</h3>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => onEdit(section)}
                aria-label={`Edit ${section.name}`}
                title="Edit section"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M11.3 1.9a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1l-8 8-3.3.8.8-3.3 7.7-8.3Z" />
                </svg>
              </button>
            </div>

            <p className={`tabular ${styles.left}`}>
              {over ? formatTaka(-remaining) : formatTaka(remaining)}
              <span>{over ? ' over budget' : ' left'}</span>
            </p>
            <div
              className={styles.meter}
              role="meter"
              aria-label={`${section.name} spent`}
              aria-valuemin={0}
              aria-valuemax={Math.max(budget, spent)}
              aria-valuenow={spent}
            >
              <span style={{ width: `${share * 100}%` }} />
            </div>
            <p className={`tabular ${styles.sectionLine}`}>
              {formatTaka(spent)} spent of {formatTaka(budget)}
            </p>

            <dl className={styles.flows}>
              {row.opening !== 0 && (
                <div>
                  <dt>Carried in</dt>
                  <dd className="tabular">{formatTaka(row.opening)}</dd>
                </div>
              )}
              {row.added > 0 && (
                <div>
                  <dt>Added</dt>
                  <dd className="tabular">{formatTaka(row.added)}</dd>
                </div>
              )}
              {row.movedIn > 0 && (
                <div>
                  <dt>Moved in</dt>
                  <dd className="tabular">{formatTaka(row.movedIn)}</dd>
                </div>
              )}
              {row.movedOut > 0 && (
                <div>
                  <dt>Moved out</dt>
                  <dd className="tabular">{formatTaka(row.movedOut)}</dd>
                </div>
              )}
              {row.debt.borrowed > 0 && (
                <div>
                  <dt>Borrowed</dt>
                  <dd className="tabular">{formatTaka(row.debt.borrowed)}</dd>
                </div>
              )}
              {row.debt.repaid > 0 && (
                <div>
                  <dt>Paid back</dt>
                  <dd className="tabular">{formatTaka(row.debt.repaid)}</dd>
                </div>
              )}
              {row.debt.lent > 0 && (
                <div>
                  <dt>Lent</dt>
                  <dd className="tabular">{formatTaka(row.debt.lent)}</dd>
                </div>
              )}
              {row.debt.returned > 0 && (
                <div>
                  <dt>Paid back to you</dt>
                  <dd className="tabular">{formatTaka(row.debt.returned)}</dd>
                </div>
              )}
            </dl>

            {(row.dailyAllowance !== null || row.runsOutOn || over) && (
              <p className={styles.pace} data-warn={over || row.runsOutOn !== null}>
                {over
                  ? `${formatTaka(-remaining)} more than the budget. Add money or move some in.`
                  : row.runsOutOn
                    ? `At this pace it runs out around ${shortDate(row.runsOutOn)}. Keep to ${formatTaka(row.dailyAllowance ?? 0)} a day to last the month.`
                    : `${formatTaka(row.dailyAllowance ?? 0)} a day for the rest of the month.`}
              </p>
            )}
            {section.carryOver && <p className={styles.carry}>Carries over to next month</p>}
          </li>
        );
      })}
    </ul>
  );
}
