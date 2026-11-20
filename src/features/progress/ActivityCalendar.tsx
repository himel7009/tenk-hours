import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  activityYears,
  buildActivityCalendar,
  type ActivityLevel,
  type ActivityRange,
} from '../../domain/activity';
import { fromDayKey, type DayKey } from '../../domain/dates';
import { formatDuration, formatHours } from '../../domain/format';
import styles from './ActivityCalendar.module.css';

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 30;
const TOP = 16;
const LEVELS: ActivityLevel[] = [0, 1, 2, 3, 4];

interface ActivityCalendarProps {
  byDay: ReadonlyMap<DayKey, number>;
  today: DayKey;
  /** Shades against this goal when given; otherwise against the busiest days shown. */
  goalMinutes?: number | null;
  /** What the time is on, for the summary: "on Deep learning". */
  subject?: string;
  /** How to show a day's value and the total. Time by default; money passes taka. */
  units?: CalendarUnits;
}

export interface CalendarUnits {
  /** "2h 15m", "৳266". */
  value: (amount: number) => string;
  /** "826 hours", "৳7,846 spent". */
  total: (amount: number) => string;
}

const TIME_UNITS: CalendarUnits = {
  value: (minutes) => formatDuration(minutes),
  total: (minutes) => `${formatHours(minutes)} hours`,
};

const days = (count: number) => `${count.toLocaleString()} day${count === 1 ? '' : 's'}`;

function describeDay(day: DayKey, minutes: number, units: CalendarUnits = TIME_UNITS): string {
  const date = fromDayKey(day).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${minutes > 0 ? units.value(minutes) : 'Nothing'} on ${date}`;
}

/**
 * A year of days, one square each, shaded by time put in: the calendar on a
 * GitHub profile. Defaults to the last 12 months; past years can be picked.
 */
export function ActivityCalendar({
  byDay,
  today,
  goalMinutes = null,
  subject,
  units = TIME_UNITS,
}: ActivityCalendarProps) {
  const [range, setRange] = useState<ActivityRange>({ kind: 'year-to-date' });
  const [hovered, setHovered] = useState<{ day: DayKey; minutes: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const years = useMemo(() => activityYears(byDay, today), [byDay, today]);
  const calendar = useMemo(
    () => buildActivityCalendar(byDay, range, today, goalMinutes),
    [byDay, range, today, goalMinutes],
  );

  // On a narrow screen, start scrolled to the latest weeks, as GitHub does.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = range.kind === 'year-to-date' ? element.scrollWidth : 0;
  }, [range]);

  const width = LEFT + calendar.weeks.length * STEP - GAP;
  const height = TOP + 7 * STEP - GAP;
  const period = range.kind === 'year' ? `in ${range.year}` : 'in the last year';

  const onHover = (event: MouseEvent<SVGSVGElement>) => {
    const target = event.target as SVGElement;
    const day = target.dataset.day;
    setHovered(day ? { day, minutes: Number(target.dataset.minutes) } : null);
  };

  return (
    <div className={styles.calendar}>
      <div className={styles.head}>
        <p className={styles.summary}>
          <strong className="tabular">{units.total(calendar.totalMinutes)}</strong> {period}
          {subject && <> on {subject}</>}
        </p>
        {years.length > 0 && (
          <div className={styles.ranges} role="group" aria-label="Show">
            <button
              type="button"
              aria-pressed={range.kind === 'year-to-date'}
              onClick={() => setRange({ kind: 'year-to-date' })}
            >
              Last 12 months
            </button>
            {years.map((year) => (
              <button
                key={year}
                type="button"
                aria-pressed={range.kind === 'year' && range.year === year}
                onClick={() => setRange({ kind: 'year', year })}
              >
                {year}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.scroller} ref={scroller}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className={styles.grid}
          role="img"
          aria-label={`${units.total(calendar.totalMinutes)} ${period} across ${days(calendar.activeDays)}`}
          onMouseOver={onHover}
          onMouseLeave={() => setHovered(null)}
        >
          {calendar.months.map(({ label, week }) => (
            <text key={`${label}-${week}`} x={LEFT + week * STEP} y={10} className={styles.label}>
              {label}
            </text>
          ))}
          {/* Monday, Wednesday and Friday, as GitHub labels them. */}
          {[1, 3, 5].map((weekday) => (
            <text key={weekday} x={0} y={TOP + weekday * STEP + CELL - 2} className={styles.label}>
              {new Date(2023, 0, 1 + weekday).toLocaleDateString(undefined, { weekday: 'short' })}
            </text>
          ))}
          {calendar.weeks.map((week, column) =>
            week.map((cell, row) =>
              cell ? (
                <rect
                  key={cell.day}
                  x={LEFT + column * STEP}
                  y={TOP + row * STEP}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  className={styles.cell}
                  data-level={cell.level}
                  data-future={cell.future}
                  data-today={cell.day === today}
                  data-day={cell.future ? undefined : cell.day}
                  data-minutes={cell.minutes}
                >
                  <title>{describeDay(cell.day, cell.minutes, units)}</title>
                </rect>
              ) : null,
            ),
          )}
        </svg>
      </div>

      <div className={styles.foot}>
        <p className={`tabular ${styles.stats}`} aria-live="polite">
          {hovered
            ? describeDay(hovered.day, hovered.minutes, units)
            : `${days(calendar.activeDays)} active. Longest run ${days(calendar.longestRun)}${
                range.kind === 'year-to-date' || range.year === fromDayKey(today).getFullYear()
                  ? `, current run ${days(calendar.currentRun)}`
                  : ''
              }.`}
        </p>
        <span className={styles.legend} aria-hidden="true">
          Less
          <svg width={LEVELS.length * STEP - GAP} height={CELL}>
            {LEVELS.map((level) => (
              <rect
                key={level}
                x={level * STEP}
                width={CELL}
                height={CELL}
                rx={2}
                className={styles.cell}
                data-level={level}
              />
            ))}
          </svg>
          More
        </span>
      </div>
    </div>
  );
}
