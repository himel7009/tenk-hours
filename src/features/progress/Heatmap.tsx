import { addDays, fromDayKey, type DayKey } from '../../domain/dates';
import { formatDay, formatDuration } from '../../domain/format';
import styles from './Heatmap.module.css';

const WEEKS = 26;
const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;
const LABEL_HEIGHT = 16;

interface HeatmapProps {
  byDay: ReadonlyMap<DayKey, number>;
  today: DayKey;
}

function levelFor(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

/** Monday-first index of the weekday, 0 to 6. */
const weekdayIndex = (day: DayKey) => (fromDayKey(day).getDay() + 6) % 7;

/** The last 26 weeks as a calendar grid, one column per week. */
export function Heatmap({ byDay, today }: HeatmapProps) {
  const firstDay = addDays(today, -(weekdayIndex(today) + (WEEKS - 1) * 7));
  const dayCount = (WEEKS - 1) * 7 + weekdayIndex(today) + 1;
  const days = Array.from({ length: dayCount }, (_, index) => addDays(firstDay, index));

  const monthLabels = days.flatMap((day, index) => {
    const date = fromDayKey(day);
    if (date.getDate() !== 1) return [];
    const label = date.toLocaleDateString(undefined, { month: 'short' });
    return [{ label, x: Math.floor(index / 7) * STEP }];
  });

  return (
    <svg
      className={styles.heatmap}
      viewBox={`0 0 ${WEEKS * STEP - GAP} ${LABEL_HEIGHT + 7 * STEP - GAP}`}
      role="img"
      aria-label="Time logged each day over the last 26 weeks"
    >
      {monthLabels.map(({ label, x }) => (
        <text key={x} x={x} y={10} className={styles.month}>
          {label}
        </text>
      ))}
      {days.map((day, index) => {
        const minutes = byDay.get(day) ?? 0;
        return (
          <rect
            key={day}
            x={Math.floor(index / 7) * STEP}
            y={LABEL_HEIGHT + (index % 7) * STEP}
            width={CELL}
            height={CELL}
            rx={2.5}
            className={styles.day}
            data-level={levelFor(minutes)}
          >
            <title>
              {formatDay(day, today)}: {minutes > 0 ? formatDuration(minutes) : 'nothing logged'}
            </title>
          </rect>
        );
      })}
    </svg>
  );
}
