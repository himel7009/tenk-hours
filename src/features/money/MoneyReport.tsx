import { useMemo, useState } from 'react';
import { usePersistentState } from '../../components/usePersistentState';
import { fromDayKey, type DayKey } from '../../domain/dates';
import { formatTaka, tagOf } from '../../domain/money';
import { periodContaining, shiftPeriod, type Period, type PeriodKind } from '../../domain/report';
import { ActivityCalendar, type CalendarUnits } from '../progress/ActivityCalendar';
import { useMoneyReport, useSpendingByDay } from '../progress/useMoney';
import styles from './Money.module.css';

const MONEY_UNITS: CalendarUnits = {
  value: (paisa) => formatTaka(paisa),
  total: (paisa) => `${formatTaka(paisa)} spent`,
};

const NOUN: Record<PeriodKind, string> = { day: 'day', week: 'week', month: 'month' };

function title(period: Period, back: number): string {
  if (period.kind === 'day') {
    if (back === 0) return 'Today';
    if (back === 1) return 'Yesterday';
    return fromDayKey(period.start).toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }
  if (period.kind === 'week') {
    if (back === 0) return 'This week';
    if (back === 1) return 'Last week';
    return `Week of ${fromDayKey(period.start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  }
  if (back === 0) return 'This month';
  return fromDayKey(period.start).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Where the money went over a day, a week or a month, against the one before. */
export function MoneyReport({ today }: { today: DayKey }) {
  const [kind, setKind] = usePersistentState<PeriodKind>('tenk.moneyPeriod', 'week');
  const [back, setBack] = useState(0);
  const period = useMemo(
    () => shiftPeriod(periodContaining(kind, today), -back),
    [kind, today, back],
  );
  const report = useMoneyReport(period);
  const byDay = useSpendingByDay();
  const noun = NOUN[kind];

  const change = report.spent - report.previousSpent;
  const compared =
    report.inProgress && kind !== 'day' ? `the same point last ${noun}` : `the ${noun} before`;
  // Whole taka, like every other figure people plan with.
  const average =
    report.elapsedDays > 0 ? Math.round(report.spent / report.elapsedDays / 100) * 100 : 0;
  const mostSection = Math.max(1, ...report.bySection.map((row) => row.spent));
  const mostTag = Math.max(1, ...report.byTag.map((row) => row.spent));
  const tallest = Math.max(1, ...report.days.map((day) => day.spent));
  const topTag = report.byTag[0];

  return (
    <div className={styles.report}>
      <div className={styles.reportBar}>
        <fieldset className={styles.switch}>
          <legend className="visually-hidden">Report by</legend>
          {(['day', 'week', 'month'] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="money-period"
                className="visually-hidden"
                checked={kind === value}
                onChange={() => {
                  setKind(value);
                  setBack(0);
                }}
              />
              {value === 'day' ? 'Day' : value === 'week' ? 'Week' : 'Month'}
            </label>
          ))}
        </fieldset>
        <div className={styles.stepper}>
          <button type="button" onClick={() => setBack(back + 1)} aria-label={`Previous ${noun}`}>
            ‹
          </button>
          <h2>{title(period, back)}</h2>
          <button
            type="button"
            onClick={() => setBack(back - 1)}
            disabled={back === 0}
            aria-label={`Next ${noun}`}
          >
            ›
          </button>
        </div>
      </div>

      <div className={styles.reportGrid}>
        <section className={styles.hero} aria-label="Spent">
          <p className={styles.heroLabel}>Spent</p>
          <p className={`tabular ${styles.heroFigure}`}>{formatTaka(report.spent)}</p>
          <p
            className={styles.heroNote}
            data-trend={
              report.previousSpent === 0
                ? 'same'
                : change > 0
                  ? 'more'
                  : change < 0
                    ? 'less'
                    : 'same'
            }
          >
            {report.previousSpent === 0
              ? report.spent === 0
                ? `Nothing spent yet this ${noun}.`
                : `Nothing was spent by ${compared}.`
              : change === 0
                ? `The same as ${compared}.`
                : `${formatTaka(Math.abs(change))} ${change > 0 ? 'more' : 'less'} than ${compared}.`}
          </p>
        </section>

        <dl className={styles.stats}>
          {kind !== 'day' && (
            <div>
              <dt>Daily average</dt>
              <dd className="tabular">{formatTaka(average)}</dd>
            </div>
          )}
          <div>
            <dt>Expenses</dt>
            <dd className="tabular">{report.spendCount}</dd>
          </div>
          {kind !== 'day' && (
            <div>
              <dt>Biggest day</dt>
              <dd className="tabular">
                {report.biggestDay ? formatTaka(report.biggestDay.spent) : '–'}
              </dd>
              {report.biggestDay && (
                <dd className={styles.statNote}>
                  {fromDayKey(report.biggestDay.day).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </dd>
              )}
            </div>
          )}
          <div>
            <dt>Money added</dt>
            <dd className="tabular">{formatTaka(report.added)}</dd>
          </div>
        </dl>

        {topTag && report.spent > 0 && (
          <p className={styles.insight}>
            {topTag.tag.icon} {topTag.tag.label} took the most:{' '}
            <strong className="tabular">{formatTaka(topTag.spent)}</strong> over {topTag.count}{' '}
            {topTag.count === 1 ? 'expense' : 'expenses'},{' '}
            {Math.round((topTag.spent / report.spent) * 100)}% of the {noun}.
          </p>
        )}

        {kind !== 'day' && (
          <section className={`${styles.card} ${styles.wide}`} aria-label="Spending by day">
            <h3 className={styles.cardTitle}>By day</h3>
            <div className={styles.bars} data-kind={kind}>
              {report.days.map((day) => {
                const date = fromDayKey(day.day);
                return (
                  <div
                    key={day.day}
                    className={styles.bar}
                    data-future={day.future}
                    data-today={day.day === today}
                    title={`${date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}: ${formatTaka(day.spent)}`}
                  >
                    <div className={styles.barColumn}>
                      {day.bySection.map(({ section, spent }) => (
                        <span
                          key={section.id}
                          data-color={section.color}
                          style={{ height: `${(spent / tallest) * 100}%` }}
                        />
                      ))}
                    </div>
                    <span className={styles.barLabel}>
                      {kind === 'week'
                        ? date.toLocaleDateString(undefined, { weekday: 'short' })
                        : (date.getDate() - 1) % 7 === 0
                          ? date.getDate()
                          : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className={styles.card} aria-labelledby="money-by-section">
          <h3 id="money-by-section" className={styles.cardTitle}>
            By section
          </h3>
          {report.bySection.length === 0 ? (
            <p className={styles.empty}>Nothing spent.</p>
          ) : (
            <ul className={styles.rows}>
              {report.bySection.map(({ section, spent, previousSpent }) => (
                <li key={section.id} data-color={section.color}>
                  <span className={styles.rowName}>
                    {section.icon} {section.name}
                  </span>
                  <span className={styles.rowBar}>
                    <span style={{ width: `${(spent / mostSection) * 100}%` }} />
                  </span>
                  <span className={`tabular ${styles.rowValue}`}>{formatTaka(spent)}</span>
                  <span
                    className={`tabular ${styles.rowChange}`}
                    data-trend={
                      spent > previousSpent ? 'more' : spent < previousSpent ? 'less' : 'same'
                    }
                    title={`Compared with ${compared}`}
                  >
                    {spent === previousSpent
                      ? 'same'
                      : `${spent > previousSpent ? '+' : '−'}${formatTaka(Math.abs(spent - previousSpent))}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.card} aria-labelledby="money-by-tag">
          <h3 id="money-by-tag" className={styles.cardTitle}>
            By kind of spending
          </h3>
          {report.byTag.length === 0 ? (
            <p className={styles.empty}>Nothing spent.</p>
          ) : (
            <ul className={styles.rows}>
              {report.byTag.map(({ tag, spent, count }) => (
                <li key={tag.id}>
                  <span className={styles.rowName}>
                    {tag.icon} {tag.label}
                    <span className={styles.rowCount}>{count}</span>
                  </span>
                  <span className={styles.rowBar} data-neutral>
                    <span style={{ width: `${(spent / mostTag) * 100}%` }} />
                  </span>
                  <span className={`tabular ${styles.rowValue}`}>{formatTaka(spent)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.cardFoot}>Worked out from the words in each expense.</p>
        </section>

        <section className={styles.card} aria-labelledby="money-largest">
          <h3 id="money-largest" className={styles.cardTitle}>
            {kind === 'day' ? 'Everything spent' : 'Largest expenses'}
          </h3>
          {report.largest.length === 0 ? (
            <p className={styles.empty}>Nothing spent.</p>
          ) : (
            <ol className={styles.largest}>
              {report.largest.map((entry) => (
                <li key={entry.id}>
                  <span>
                    {entry.note || 'No details'}
                    <span className={styles.rowCount}>
                      {tagOf(entry.note).icon}{' '}
                      {fromDayKey(entry.day).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </span>
                  <span className="tabular">{formatTaka(entry.amount)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className={`${styles.card} ${styles.wide}`} aria-labelledby="money-calendar">
          <h3 id="money-calendar" className={styles.cardTitle}>
            Spending calendar
          </h3>
          <ActivityCalendar byDay={byDay} today={today} units={MONEY_UNITS} />
        </section>
      </div>
    </div>
  );
}
