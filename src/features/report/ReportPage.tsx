import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { usePersistentState } from '../../components/usePersistentState';
import { daysBetween, fromDayKey, type DayKey } from '../../domain/dates';
import { formatDuration } from '../../domain/format';
import {
  periodContaining,
  shiftPeriod,
  type Period,
  type PeriodKind,
  type Report,
  type TrackerReport,
} from '../../domain/report';
import {
  ALMOST_DONE_PERCENT,
  nextUnitLabel,
  progressLabel,
  remainingLabel,
  summarizeLibrary,
} from '../../domain/library';
import { useTrackerStore } from '../../store/trackerStore';
import { useBadHabitsLocked } from '../badHabits/lockSession';
import { useToday } from '../progress/useNow';
import { useReport, useTrend } from '../progress/useReport';
import styles from './ReportPage.module.css';

const TREND_LENGTH: Record<PeriodKind, number> = { day: 14, week: 8, month: 6 };

export function ReportPage() {
  const today = useToday();
  const [kind, setKind] = usePersistentState<PeriodKind>('tenk.reportPeriod', 'week');
  // How many periods back from the current one. Resets when switching kind.
  const [offset, setOffset] = useState(0);
  const period = useMemo(
    () => shiftPeriod(periodContaining(kind, today), -offset),
    [kind, today, offset],
  );
  const report = useReport(period);
  // The trend stays on the latest periods while the chosen one is among them.
  const trendLength = TREND_LENGTH[kind];
  const trendEndOffset = offset < trendLength ? 0 : offset;
  const trendEnd = useMemo(
    () => shiftPeriod(periodContaining(kind, today), -trendEndOffset),
    [kind, today, trendEndOffset],
  );
  const trend = useTrend(trendEnd, trendLength);
  const noun = kind === 'week' ? 'week' : 'month';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.heading}>Report</h1>
          <p className={styles.lede}>How your {noun} went, compared with the one before.</p>
        </div>
        <fieldset className={styles.switch}>
          <legend className="visually-hidden">Report by</legend>
          {(['week', 'month'] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="report-period"
                className="visually-hidden"
                checked={kind === value}
                onChange={() => {
                  setKind(value);
                  setOffset(0);
                }}
              />
              {value === 'week' ? 'Week' : 'Month'}
            </label>
          ))}
        </fieldset>
      </header>

      <div className={styles.stepper}>
        <button
          type="button"
          className={styles.step}
          onClick={() => setOffset(offset + 1)}
          aria-label={`Previous ${noun}`}
        >
          ‹
        </button>
        <div className={styles.periodName}>
          <h2>{periodTitle(period, offset)}</h2>
          <p className="tabular">{periodRange(period)}</p>
        </div>
        <button
          type="button"
          className={styles.step}
          onClick={() => setOffset(offset - 1)}
          disabled={offset === 0}
          aria-label={`Next ${noun}`}
        >
          ›
        </button>
      </div>

      <div className={styles.grid}>
        <Summary report={report} noun={noun} />
        <DailyChart report={report} today={today} />
        <section
          className={`${styles.card} ${styles.trendCard}`}
          aria-label={`Last ${trend.length} ${noun}s`}
        >
          <h2 className={styles.cardTitle}>
            Last {trend.length} {noun}s
          </h2>
          <div className={styles.trend}>
            {trend.map((point, index) => {
              const tallest = Math.max(60, ...trend.map((p) => p.minutes));
              const stepsBack = trend.length - 1 - index + trendEndOffset;
              return (
                <button
                  key={point.period.start}
                  type="button"
                  className={styles.trendBar}
                  data-selected={stepsBack === offset}
                  onClick={() => setOffset(stepsBack)}
                  aria-label={`${periodTitle(point.period, stepsBack)}: ${formatDuration(point.minutes)}`}
                  aria-pressed={stepsBack === offset}
                >
                  <span className={`tabular ${styles.trendValue}`}>
                    {point.minutes > 0 ? formatHoursShort(point.minutes) : ''}
                  </span>
                  <span className={styles.trendColumn}>
                    <span style={{ height: `${(point.minutes / tallest) * 100}%` }} />
                  </span>
                  <span className={styles.trendLabel}>{shortLabel(point.period)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <Breakdown report={report} noun={noun} />
        <div className={styles.side}>
          <BadHabitsSection report={report} />
          <LibrarySection />
        </div>
      </div>
    </div>
  );
}

function Summary({ report, noun }: { report: Report; noun: string }) {
  const change = report.totalMinutes - report.previousMinutes;
  const average = report.elapsedDays > 0 ? report.totalMinutes / report.elapsedDays : 0;
  const compared = report.inProgress ? `the same point last ${noun}` : `the ${noun} before`;
  const goalShare = report.goals.possible > 0 ? report.goals.met / report.goals.possible : null;

  return (
    <>
      <section className={`${styles.card} ${styles.hero}`} aria-label="Total time">
        <p className={styles.heroLabel}>Time spent</p>
        <p className={`tabular ${styles.heroFigure}`}>{formatDuration(report.totalMinutes)}</p>
        <p
          className={styles.heroNote}
          data-trend={change > 0 ? 'up' : change < 0 ? 'down' : 'flat'}
        >
          {report.previousMinutes === 0
            ? report.totalMinutes === 0
              ? `Nothing logged yet this ${noun}.`
              : `Nothing was logged by ${compared}.`
            : change === 0
              ? `Level with ${compared}.`
              : `${formatDuration(Math.abs(change))} ${change > 0 ? 'more' : 'less'} than ${compared} (${change > 0 ? '+' : '−'}${Math.round((Math.abs(change) / report.previousMinutes) * 100)}%).`}
        </p>
      </section>

      <dl className={styles.stats}>
        <div className={styles.card}>
          <dt className={styles.cardTitle}>Daily average</dt>
          <dd className={`tabular ${styles.cardFigure}`}>{formatDuration(average)}</dd>
          <dd className={styles.cardNote}>over {plural(report.elapsedDays, 'day')} so far</dd>
        </div>
        <div className={styles.card}>
          <dt className={styles.cardTitle}>Days you showed up</dt>
          <dd className={`tabular ${styles.cardFigure}`}>
            {report.activeDays} <span className={styles.of}>of {report.elapsedDays}</span>
          </dd>
          <dd className={styles.cardNote}>days with any time logged</dd>
        </div>
        <div className={styles.card}>
          <dt className={styles.cardTitle}>Daily goals reached</dt>
          <dd className={`tabular ${styles.cardFigure}`}>
            {goalShare === null ? '–' : `${Math.round(goalShare * 100)}%`}
          </dd>
          <dd className={styles.cardNote}>
            {goalShare === null
              ? 'No skills or habits with a daily goal'
              : `${report.goals.met} of ${report.goals.possible} skill-days`}
          </dd>
        </div>
        <div className={styles.card}>
          <dt className={styles.cardTitle}>Best day</dt>
          <dd className={`tabular ${styles.cardFigure}`}>
            {report.bestDay ? formatDuration(report.bestDay.minutes) : '–'}
          </dd>
          <dd className={styles.cardNote}>
            {report.bestDay
              ? fromDayKey(report.bestDay.day).toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                })
              : 'No time logged yet'}
            {report.longestSession &&
              `. Longest session ${formatDuration(report.longestSession.minutes)} on ${report.longestSession.skill.name}.`}
          </dd>
        </div>
      </dl>
    </>
  );
}

function DailyChart({ report, today }: { report: Report; today: DayKey }) {
  const tallest = Math.max(60, ...report.days.map((day) => day.minutes));
  const isWeek = report.period.kind === 'week';
  return (
    <section className={`${styles.card} ${styles.dailyCard}`} aria-label="Time by day">
      <h2 className={styles.cardTitle}>Time by day</h2>
      <div className={styles.daily} data-kind={report.period.kind}>
        {report.days.map((day) => {
          const date = fromDayKey(day.day);
          const label = isWeek
            ? date.toLocaleDateString(undefined, { weekday: 'short' })
            : String(date.getDate());
          // A month shows every seventh date so the labels never collide.
          const showLabel = isWeek || (date.getDate() - 1) % 7 === 0 || day.day === today;
          return (
            <div
              key={day.day}
              className={styles.day}
              data-future={day.future}
              data-today={day.day === today}
              title={`${date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}: ${formatDuration(day.minutes)}`}
            >
              <div className={styles.dayColumn}>
                {day.segments.map(({ skill, minutes }) => (
                  <span
                    key={skill.id}
                    data-color={skill.color}
                    style={{ height: `${(minutes / tallest) * 100}%` }}
                  />
                ))}
              </div>
              <span className={styles.dayLabel} aria-hidden={!showLabel}>
                {showLabel ? label : ''}
              </span>
            </div>
          );
        })}
      </div>
      <p className="visually-hidden">
        {report.days
          .filter((day) => !day.future)
          .map((day) => `${day.day}: ${formatDuration(day.minutes)}`)
          .join(', ')}
      </p>
    </section>
  );
}

function Breakdown({ report, noun }: { report: Report; noun: string }) {
  const most = Math.max(1, ...report.trackers.map((tracker) => tracker.minutes));
  return (
    <section className={`${styles.card} ${styles.breakdown}`} aria-labelledby="report-breakdown">
      <h2 id="report-breakdown" className={styles.sectionTitle}>
        Where the time went
      </h2>
      {report.trackers.length === 0 ? (
        <p className={styles.empty}>
          Nothing to show for this {noun}. <Link to="/">Start a timer from the home page</Link> and
          it will appear here.
        </p>
      ) : (
        <ul className={styles.rows}>
          {report.trackers.map((tracker) => (
            <TrackerRow key={tracker.skill.id} tracker={tracker} most={most} />
          ))}
        </ul>
      )}

      {report.domains.length > 0 && (
        <>
          <h3 className={styles.subTitle}>By domain</h3>
          <ul className={styles.rows}>
            {report.domains.map(({ domain, minutes, previousMinutes }) => (
              <li key={domain.id} className={styles.row} data-color={domain.color}>
                <span className={styles.icon} aria-hidden="true">
                  {domain.icon}
                </span>
                <span className={styles.name}>{domain.name}</span>
                <span className={styles.bar}>
                  <span style={{ width: `${(minutes / most) * 100}%` }} />
                </span>
                <span className={`tabular ${styles.time}`}>{formatDuration(minutes)}</span>
                <Change now={minutes} before={previousMinutes} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function TrackerRow({ tracker, most }: { tracker: TrackerReport; most: number }) {
  const { skill, minutes, previousMinutes, goal, sessions } = tracker;
  return (
    <li className={styles.row} data-color={skill.color}>
      <span className={styles.icon} aria-hidden="true">
        {skill.icon}
      </span>
      <span className={styles.name}>
        <Link to={`/skills/${skill.id}`}>{skill.name}</Link>
        <span className={styles.meta}>
          {goal ? `Goal reached ${goal.met} of ${plural(goal.possible, 'day')}` : 'Project'}
          {sessions > 0 && `, ${plural(sessions, 'session')}`}
        </span>
      </span>
      <span className={styles.bar}>
        <span style={{ width: `${(minutes / most) * 100}%` }} />
      </span>
      <span className={`tabular ${styles.time}`}>{formatDuration(minutes)}</span>
      <Change now={minutes} before={previousMinutes} />
    </li>
  );
}

function Change({ now, before }: { now: number; before: number }) {
  const change = now - before;
  return (
    <span
      className={`tabular ${styles.change}`}
      data-trend={change > 0 ? 'up' : change < 0 ? 'down' : 'flat'}
      title="Compared with the period before"
    >
      {change === 0 ? 'same' : `${change > 0 ? '+' : '−'}${formatDuration(Math.abs(change))}`}
    </span>
  );
}

function BadHabitsSection({ report }: { report: Report }) {
  const locked = useBadHabitsLocked();
  if (report.badHabits.length === 0) return null;
  return (
    <section className={`${styles.card} ${styles.badCard}`} aria-labelledby="report-bad">
      <h2 id="report-bad" className={styles.sectionTitle}>
        Bad habits
      </h2>
      {locked ? (
        <p className={styles.empty}>
          Locked with a PIN. Unlock them on the home page to see how you did.
        </p>
      ) : (
        <ul className={styles.badRows}>
          {report.badHabits.map(({ habit, clean, slipped, unanswered }) => {
            const total = Math.max(1, clean + slipped + unanswered);
            return (
              <li key={habit.id}>
                <span className={styles.badName}>
                  <span aria-hidden="true">{habit.icon}</span> {habit.name}
                </span>
                <span className={styles.badBar} aria-hidden="true">
                  <span data-status="clean" style={{ width: `${(clean / total) * 100}%` }} />
                  <span data-status="slipped" style={{ width: `${(slipped / total) * 100}%` }} />
                </span>
                <span className={styles.meta}>
                  {plural(clean, 'clean day')}, {plural(slipped, 'slip')}
                  {unanswered > 0 && `, ${unanswered} not answered`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const LIBRARY_ICONS = { book: '📖', course: '🎓' } as const;
const LIBRARY_COLORS = { book: 'teal', course: 'plum' } as const;

/**
 * Where each book and course stands now. The library keeps no history of
 * when progress was made, so this is today's picture, not the period's.
 */
function LibrarySection() {
  const library = useTrackerStore((state) => state.library);
  const summary = useMemo(() => summarizeLibrary(library), [library]);
  if (summary.inProgress.length === 0 && summary.finished === 0) return null;

  return (
    <section className={`${styles.card} ${styles.libraryCard}`} aria-labelledby="report-library">
      <div className={styles.libraryHead}>
        <h2 id="report-library" className={styles.sectionTitle}>
          Library
        </h2>
        <p className={styles.meta}>Where you are now</p>
      </div>
      {summary.averagePercent !== null && (
        <p className={styles.libraryAverage}>
          <span className={`tabular ${styles.cardFigure}`}>{summary.averagePercent}%</span>
          <span className={styles.meta}>
            done on average across{' '}
            {plural(summary.inProgress.filter(({ progress }) => progress).length, 'item')} in
            progress
          </span>
        </p>
      )}
      <ul className={styles.libraryRows}>
        {summary.inProgress.map(({ item, progress }) => {
          const next = nextUnitLabel(item);
          const left = remainingLabel(item);
          return (
            <li key={item.id} data-color={LIBRARY_COLORS[item.kind]}>
              <div className={styles.libraryTitle}>
                <span aria-hidden="true">{LIBRARY_ICONS[item.kind]}</span>
                <span className={styles.libraryName}>{item.title}</span>
                {progress && (
                  <span className={`tabular ${styles.libraryPercent}`}>{progress.percent}%</span>
                )}
              </div>
              {progress && (
                <span className={styles.bar} aria-hidden="true">
                  <span style={{ width: `${progress.percent}%` }} />
                </span>
              )}
              <span className={styles.meta}>
                {progressLabel(item)}
                {left && `, ${left}`}
                {item.status === 'paused'
                  ? '. Paused'
                  : progress && progress.percent >= ALMOST_DONE_PERCENT
                    ? '. Almost there'
                    : ''}
                {next && item.status !== 'paused' && `. Up next: ${next}`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className={styles.libraryFoot}>
        {summary.finished} finished
        {summary.planned > 0 && `, ${summary.planned} saved for later`}.{' '}
        <Link to="/library">Open library</Link>
      </p>
    </section>
  );
}

function plural(count: number, word: string): string {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

function formatHoursShort(minutes: number): string {
  const hours = minutes / 60;
  return hours >= 10 ? `${Math.round(hours)}h` : `${Math.round(hours * 10) / 10}h`;
}

function periodTitle(period: Period, stepsBack: number): string {
  if (period.kind === 'week') {
    if (stepsBack === 0) return 'This week';
    if (stepsBack === 1) return 'Last week';
    return `Week of ${fromDayKey(period.start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  }
  if (stepsBack === 0) return 'This month';
  return fromDayKey(period.start).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function periodRange(period: Period): string {
  const start = fromDayKey(period.start);
  const end = fromDayKey(period.end);
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const sameYear = start.getFullYear() === new Date().getFullYear();
  return `${start.toLocaleDateString(undefined, options)} – ${end.toLocaleDateString(undefined, sameYear ? options : { ...options, year: 'numeric' })}, ${daysBetween(period.start, period.end) + 1} days`;
}

function shortLabel(period: Period): string {
  const start = fromDayKey(period.start);
  return period.kind === 'week'
    ? start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : start.toLocaleDateString(undefined, { month: 'short' });
}
