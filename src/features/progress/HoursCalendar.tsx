import { useMemo, useState } from 'react';
import { usePersistentState } from '../../components/usePersistentState';
import { fromDayKey, type DayKey } from '../../domain/dates';
import { formatDuration } from '../../domain/format';
import {
  buildHoursMonth,
  firstMonth,
  HOUR_STEPS,
  levelEmoji,
  levelRange,
  monthOf,
  shiftMonth,
  type MonthDay,
} from '../../domain/hoursCalendar';
import styles from './HoursCalendar.module.css';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** "5.5h", "45m": short enough for a day square. */
function shortHours(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  return `${hours.toLocaleString(undefined, { maximumFractionDigits: hours < 10 ? 1 : 0 })}h`;
}

const longDay = (day: DayKey) =>
  fromDayKey(day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

interface HoursCalendarProps {
  /** Minutes per day across everything. */
  byDay: ReadonlyMap<DayKey, number>;
  today: DayKey;
}

/**
 * A month of days, each lit by the total time put in across everything:
 * brighter the more hours, on fixed two-hour steps, or shown as emoji.
 */
export function HoursCalendar({ byDay, today }: HoursCalendarProps) {
  const thisMonth = monthOf(today);
  const [month, setMonth] = useState(thisMonth);
  const [look, setLook] = usePersistentState<'colour' | 'emoji'>('tenk:hours-look', 'colour');
  const earliest = useMemo(() => firstMonth(byDay, today), [byDay, today]);
  const data = useMemo(() => buildHoursMonth(byDay, month, today), [byDay, month, today]);
  const title = fromDayKey(`${month}-01`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className={styles.card} aria-labelledby="hours-title" data-look={look}>
      <div className={styles.head}>
        <h2 id="hours-title" className={styles.title}>
          {title}
        </h2>
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.arrow}
            aria-label="Previous month"
            disabled={month <= earliest}
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            ‹
          </button>
          {month !== thisMonth && (
            <button type="button" className={styles.now} onClick={() => setMonth(thisMonth)}>
              Today
            </button>
          )}
          <button
            type="button"
            className={styles.arrow}
            aria-label="Next month"
            disabled={month >= thisMonth}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            ›
          </button>
        </div>
      </div>

      <dl className={styles.totals}>
        <div>
          <dt>Total</dt>
          <dd className="tabular">{formatDuration(data.totalMinutes)}</dd>
        </div>
        <div>
          <dt>Days worked</dt>
          <dd className="tabular">{data.activeDays}</dd>
        </div>
        <div>
          <dt>Per day worked</dt>
          <dd className="tabular">{data.activeDays ? formatDuration(data.averageMinutes) : '–'}</dd>
        </div>
      </dl>

      <table className={styles.grid}>
        <caption className="visually-hidden">Total time each day in {title}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((name, i) => (
              <th key={i} scope="col" abbr={name}>
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.weeks.map((week, w) => (
            <tr key={w}>
              {week.map((cell, d) =>
                cell ? <DayCell key={cell.day} cell={cell} look={look} /> : <td key={d} />,
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {data.best && (
        <p className={styles.best}>
          Best day: <strong>{longDay(data.best.day)}</strong>, {formatDuration(data.best.minutes)}
        </p>
      )}

      <div className={styles.foot}>
        <ul className={styles.legend} aria-label="Key">
          {HOUR_STEPS.map(({ level }) => (
            <li key={level}>
              <span className={styles.swatch} data-level={level} aria-hidden="true">
                {look === 'emoji' && levelEmoji(level)}
              </span>
              {levelRange(level)}
            </li>
          ))}
        </ul>
        <div className={styles.looks} role="group" aria-label="Show days as">
          <button type="button" aria-pressed={look === 'colour'} onClick={() => setLook('colour')}>
            Colour
          </button>
          <button type="button" aria-pressed={look === 'emoji'} onClick={() => setLook('emoji')}>
            Emoji
          </button>
        </div>
      </div>
    </section>
  );
}

function DayCell({ cell, look }: { cell: MonthDay; look: 'colour' | 'emoji' }) {
  const date = fromDayKey(cell.day).getDate();
  const label = `${longDay(cell.day)}: ${
    cell.isFuture ? 'still to come' : cell.minutes > 0 ? formatDuration(cell.minutes) : 'nothing'
  }`;
  return (
    <td>
      <div
        className={styles.day}
        data-level={cell.isFuture ? undefined : cell.level}
        data-future={cell.isFuture || undefined}
        data-today={cell.isToday || undefined}
        title={label}
        aria-label={label}
      >
        <span className={styles.date} aria-hidden="true">
          {date}
        </span>
        {!cell.isFuture && cell.minutes > 0 && (
          <span className={styles.amount} aria-hidden="true">
            {look === 'emoji' ? levelEmoji(cell.level) : shortHours(cell.minutes)}
          </span>
        )}
      </div>
    </td>
  );
}
