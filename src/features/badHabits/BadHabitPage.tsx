import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../../components/Button';
import type { BadHabit, BadHabitReport, CheckInStatus } from '../../domain/badHabits';
import { addDays, daysBetween, fromDayKey, type DayKey } from '../../domain/dates';
import { formatDay } from '../../domain/format';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from '../progress/useNow';
import { BadHabitFormDialog } from './BadHabitFormDialog';
import { usePrivacyLocked } from './lockSession';
import { LockScreen } from './LockScreen';
import { useBadHabitReport } from './useBadHabitProgress';
import styles from './BadHabitPage.module.css';

const days = (count: number) => `${count} day${count === 1 ? '' : 's'}`;
const percent = (share: number) => `${Math.round(share * 100)}%`;
const weekdayName = (weekday: number, style: 'short' | 'long' = 'long') =>
  // 2023-01-01 was a Sunday.
  new Date(2023, 0, 1 + weekday).toLocaleDateString(undefined, { weekday: style });

/** Tapping a day on the calendar moves it on: no answer, clean, slipped, none. */
const NEXT_STATUS: Record<'none' | CheckInStatus, CheckInStatus | null> = {
  none: 'clean',
  clean: 'slipped',
  slipped: null,
};

const MAX_WEEKS = 26;

export function BadHabitPage() {
  const { habitId } = useParams();
  const habit = useTrackerStore((state) => state.badHabits.find((h) => h.id === habitId));
  const locked = usePrivacyLocked();
  if (locked) return <LockScreen />;
  if (!habit) {
    return (
      <div>
        <h1>This page no longer exists</h1>
        <p className={styles.note}>
          <Link to="/">Go back home</Link>
        </p>
      </div>
    );
  }
  return <BadHabitDetail key={habit.id} habit={habit} />;
}

function BadHabitDetail({ habit }: { habit: BadHabit }) {
  const today = useToday();
  const report = useBadHabitReport(habit);
  const setCheckIn = useTrackerStore((state) => state.setCheckIn);
  const [editing, setEditing] = useState(false);
  const { todayStatus } = report;

  return (
    <div data-color={habit.color}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>
          Home
        </Link>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <span className={styles.icon} aria-hidden="true">
              {habit.icon}
            </span>
            {habit.name}
          </h1>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
        <p className={styles.note}>
          Staying away from it since {formatDay(report.since, today)}, {days(report.trackedDays)} so
          far.
        </p>
      </header>

      <section className={styles.today} aria-labelledby="today-title">
        <h2 id="today-title" className={styles.todayTitle}>
          {todayStatus === null
            ? 'How did today go?'
            : todayStatus === 'clean'
              ? 'Clean today. Well done.'
              : 'Slipped today. Tomorrow is a new day.'}
        </h2>
        <div className={styles.answers} role="group" aria-label="Today's answer">
          <Button
            variant={todayStatus === 'clean' ? 'primary' : 'secondary'}
            aria-pressed={todayStatus === 'clean'}
            onClick={() => setCheckIn(habit.id, today, todayStatus === 'clean' ? null : 'clean')}
          >
            Stayed clean
          </Button>
          <Button
            variant={todayStatus === 'slipped' ? 'primary' : 'secondary'}
            aria-pressed={todayStatus === 'slipped'}
            onClick={() =>
              setCheckIn(habit.id, today, todayStatus === 'slipped' ? null : 'slipped')
            }
          >
            Slipped
          </Button>
        </div>
      </section>

      <dl className={styles.stats}>
        <Stat label="Clean streak" value={days(report.currentStreak)} />
        <Stat label="Best streak" value={days(report.longestStreak)} />
        <Stat
          label="Since the last slip"
          value={report.daysSinceLastSlip === null ? 'No slips' : days(report.daysSinceLastSlip)}
        />
        <Stat
          label="Clean, last 30 days"
          value={report.cleanRate30 === null ? 'No answers' : percent(report.cleanRate30)}
        />
      </dl>

      <section className={styles.section} aria-labelledby="calendar-title">
        <h2 id="calendar-title" className={styles.sectionTitle}>
          Day by day
        </h2>
        <HabitCalendar
          report={report}
          today={today}
          onCycle={(day) => setCheckIn(habit.id, day, NEXT_STATUS[report.byDay.get(day) ?? 'none'])}
        />
      </section>

      <section className={styles.section} aria-labelledby="weak-title">
        <h2 id="weak-title" className={styles.sectionTitle}>
          Weak spots
        </h2>
        <WeakSpots report={report} />
      </section>

      <section className={styles.section} aria-labelledby="months-title">
        <h2 id="months-title" className={styles.sectionTitle}>
          Month by month
        </h2>
        <MonthTable report={report} />
      </section>

      {editing && <BadHabitFormDialog habit={habit} onClose={() => setEditing(false)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

const STATUS_LABEL = {
  clean: 'clean',
  slipped: 'slipped',
  unanswered: 'no answer',
} as const;

/**
 * The month's name over the week its first day falls in. The first column is
 * labelled too, unless a new month starts close enough to crowd it.
 */
function monthLabel(weeks: DayKey[][], index: number): string {
  const week = weeks[index] ?? [];
  const first = week.find((day) => day.endsWith('-01'));
  if (first) return short(first);
  if (index !== 0) return '';
  const crowded = weeks.slice(1, 3).some((w) => w.some((day) => day.endsWith('-01')));
  return crowded || !week[0] ? '' : short(week[0]);
}

const shortMonthYear = (day: DayKey) =>
  fromDayKey(day).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

const short = (day: DayKey) => fromDayKey(day).toLocaleDateString(undefined, { month: 'short' });

/** Weeks across, Sunday on top; each day can be tapped to change its answer. */
function HabitCalendar({
  report,
  today,
  onCycle,
}: {
  report: BadHabitReport;
  today: DayKey;
  onCycle: (day: DayKey) => void;
}) {
  const since = report.since;
  const weeks = useMemo(() => {
    const thisSunday = addDays(today, -fromDayKey(today).getDay());
    // From the week tracking began, at most half a year back.
    const count = Math.min(MAX_WEEKS, Math.floor(daysBetween(since, thisSunday) / 7) + 1);
    const start = addDays(thisSunday, -(Math.max(count, 1) - 1) * 7);
    return Array.from({ length: Math.max(count, 1) }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)),
    );
  }, [since, today]);

  // On a narrow screen the calendar scrolls; open it on the latest weeks.
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks]);

  return (
    <div className={styles.calendarWrap}>
      <div ref={scroller} className={styles.calendar} role="grid" aria-label="Answers by day">
        {weeks.map((week, w) => (
          <div key={week[0]} className={styles.week} role="row">
            <span className={styles.month} aria-hidden="true">
              {monthLabel(weeks, w)}
            </span>
            {week.map((day) => {
              const status = report.statusOn(day);
              if (status === 'future' || status === 'before') {
                return <span key={day} className={styles.blank} role="gridcell" />;
              }
              return (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  className={styles.cell}
                  data-status={status}
                  data-today={day === today || undefined}
                  title={`${formatDay(day, today)}: ${STATUS_LABEL[status]}`}
                  aria-label={`${formatDay(day, today)}: ${STATUS_LABEL[status]}. Change the answer`}
                  onClick={() => onCycle(day)}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className={styles.legend}>
        <span className={styles.key} data-status="clean" /> Clean
        <span className={styles.key} data-status="slipped" /> Slipped
        <span className={styles.key} data-status="unanswered" /> No answer
        <span className={styles.hint}>Tap a day to change its answer.</span>
      </p>
    </div>
  );
}

function WeakSpots({ report }: { report: BadHabitReport }) {
  const answered = report.cleanDays + report.slippedDays;
  if (answered === 0) {
    return (
      <p className={styles.note}>
        Answer a few days and this will show when it tends to catch you: which weekdays, how often,
        and whether it is getting easier.
      </p>
    );
  }
  const { riskiestWeekday: risky, slipsLast30, slipsPrevious30 } = report;
  const trend =
    slipsLast30 < slipsPrevious30
      ? `Fewer slips in the last 30 days (${slipsLast30}) than the 30 before (${slipsPrevious30}). It is getting easier.`
      : slipsLast30 > slipsPrevious30
        ? `More slips in the last 30 days (${slipsLast30}) than the 30 before (${slipsPrevious30}). Worth watching.`
        : slipsLast30 === 0
          ? 'No slips in the last 60 days.'
          : `As many slips in the last 30 days as the 30 before (${slipsLast30}).`;
  const top = Math.max(...report.byWeekday.map((w) => w.slipRate ?? 0), 0.01);

  return (
    <div className={styles.weak}>
      <ul className={styles.insights}>
        {risky && (
          <li>
            <strong>{weekdayName(risky.weekday)}s are the hardest.</strong> {risky.slips} of{' '}
            {risky.answered} answered {weekdayName(risky.weekday)}s were slips. Plan something for
            that day.
          </li>
        )}
        {report.averageGap !== null && (
          <li>
            Slips tend to come about every <strong>{days(report.averageGap)}</strong>.
            {report.daysSinceLastSlip !== null &&
              report.daysSinceLastSlip >= report.averageGap &&
              ' You are past that now, so keep going.'}
          </li>
        )}
        <li>{trend}</li>
        {report.unansweredDays > 0 && (
          <li>
            {days(report.unansweredDays)} with no answer. A day without one ends a streak, so answer
            even the easy days.
          </li>
        )}
      </ul>

      <ol className={styles.weekdays} aria-label="Slips by weekday">
        {report.byWeekday.map((w) => (
          <li key={w.weekday} className={styles.weekday}>
            <span className={styles.weekdayName}>{weekdayName(w.weekday, 'short')}</span>
            <span className={styles.bar} aria-hidden="true">
              <span
                className={styles.barFill}
                data-risky={w.weekday === risky?.weekday || undefined}
                style={{ height: `${((w.slipRate ?? 0) / top) * 100}%` }}
              />
            </span>
            <span className={`tabular ${styles.weekdayValue}`}>
              {w.answered === 0 ? '–' : `${w.slips}/${w.answered}`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MonthTable({ report }: { report: BadHabitReport }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Clean</th>
            <th scope="col">Slipped</th>
            <th scope="col">No answer</th>
            <th scope="col">Clean rate</th>
          </tr>
        </thead>
        <tbody>
          {[...report.months].reverse().map((m) => {
            const answered = m.clean + m.slipped;
            return (
              <tr key={m.month}>
                <th scope="row">{shortMonthYear(`${m.month}-01`)}</th>
                <td className="tabular">{m.clean}</td>
                <td className="tabular">{m.slipped}</td>
                <td className="tabular">{m.unanswered}</td>
                <td className="tabular">{answered === 0 ? '–' : percent(m.clean / answered)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
