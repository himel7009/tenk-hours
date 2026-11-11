import type { DayKey } from './dates';
import { nextMilestone } from './milestones';
import { dailyPace, minutesByDay, projectFinish, totalMinutes } from './stats';
import { computeStreak, type Streak } from './streaks';
import type { Session } from './types';

export interface Progress {
  loggedMinutes: number;
  minutesToday: number;
  byDay: Map<DayKey, number>;
  streak: Streak;
  /** Average minutes per day over the recent window. */
  pace: number;
  finishDay: DayKey | null;
  nextMilestoneHours: number | null;
}

/** Everything the UI shows about a set of sessions, derived in one pass. */
export function summarizeProgress(
  sessions: readonly Session[],
  targetHours: number,
  today: DayKey,
): Progress {
  const loggedMinutes = totalMinutes(sessions);
  const byDay = minutesByDay(sessions);
  const pace = dailyPace(byDay, today);

  return {
    loggedMinutes,
    minutesToday: byDay.get(today) ?? 0,
    byDay,
    streak: computeStreak(new Set(byDay.keys()), today),
    pace,
    finishDay: projectFinish(loggedMinutes, targetHours, pace, today),
    nextMilestoneHours: nextMilestone(loggedMinutes, targetHours),
  };
}
