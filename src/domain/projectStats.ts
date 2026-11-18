import { addDays, type DayKey } from './dates';

export interface ProjectStats {
  /** The last seven days, today included. */
  weekMinutes: number;
  /** The last thirty days, today included. */
  monthMinutes: number;
  daysWorked: number;
  firstDay: DayKey | null;
  lastDay: DayKey | null;
}

/** What a project page shows: where the time went, with no goals involved. */
export function projectStats(byDay: ReadonlyMap<DayKey, number>, today: DayKey): ProjectStats {
  const since = (days: number) => {
    const start = addDays(today, -(days - 1));
    let minutes = 0;
    for (const [day, value] of byDay) if (day >= start && day <= today) minutes += value;
    return minutes;
  };
  const days = [...byDay.keys()].sort();
  return {
    weekMinutes: since(7),
    monthMinutes: since(30),
    daysWorked: days.length,
    firstDay: days[0] ?? null,
    lastDay: days.at(-1) ?? null,
  };
}
