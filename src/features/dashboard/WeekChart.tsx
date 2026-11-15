import { fromDayKey, type DayKey } from '../../domain/dates';
import type { Dashboard } from '../../domain/dashboard';
import { formatDay, formatDuration } from '../../domain/format';
import styles from './dashboard.module.css';

const WIDTH = 420;
const HEIGHT = 150;
const LABEL_HEIGHT = 20;
const BAR_WIDTH = 44;
const PLOT_HEIGHT = HEIGHT - LABEL_HEIGHT;

interface WeekChartProps {
  dashboard: Dashboard;
  today: DayKey;
}

/** The last seven days as stacked bars, one colour per skill or habit. */
export function WeekChart({ dashboard, today }: WeekChartProps) {
  const { week, weekMinutes, previousWeekMinutes } = dashboard;
  const tallest = Math.max(60, ...week.map((bar) => bar.minutes));
  const slot = WIDTH / week.length;
  const change = weekMinutes - previousWeekMinutes;

  return (
    <section className={`${styles.card} ${styles.weekCard}`} aria-label="Last 7 days">
      <div className={styles.weekHead}>
        <div>
          <h2 className={styles.cardTitle}>Last 7 days</h2>
          <p className={`tabular ${styles.cardFigure}`}>{formatDuration(weekMinutes)}</p>
        </div>
        <p className={`tabular ${styles.cardNote}`}>
          {change === 0
            ? 'Same as the 7 days before'
            : `${formatDuration(Math.abs(change))} ${change > 0 ? 'more' : 'less'} than the 7 days before`}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={styles.chart}
        role="img"
        aria-label={week
          .map((bar) => `${formatDay(bar.day, today)}: ${formatDuration(bar.minutes)}`)
          .join(', ')}
      >
        {week.map((bar, index) => {
          const x = index * slot + (slot - BAR_WIDTH) / 2;
          let top = PLOT_HEIGHT;
          return (
            <g key={bar.day}>
              <rect
                x={x}
                y={0}
                width={BAR_WIDTH}
                height={PLOT_HEIGHT}
                rx={6}
                className={styles.barTrack}
              />
              {bar.segments.map(({ skill, minutes }) => {
                const height = (minutes / tallest) * PLOT_HEIGHT;
                top -= height;
                return (
                  <rect
                    key={skill.id}
                    x={x}
                    y={top}
                    width={BAR_WIDTH}
                    height={height}
                    className={styles.barSegment}
                    data-color={skill.color}
                  >
                    <title>
                      {skill.name}: {formatDuration(minutes)}
                    </title>
                  </rect>
                );
              })}
              <text
                x={x + BAR_WIDTH / 2}
                y={HEIGHT - 4}
                className={styles.barLabel}
                data-today={bar.day === today}
              >
                {fromDayKey(bar.day).toLocaleDateString(undefined, { weekday: 'short' })}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
