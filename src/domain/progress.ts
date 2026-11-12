import type { DayKey } from './dates';
import { nextMilestone } from './milestones';
import { dailyPace, minutesByDay, projectFinish, totalMinutes } from './stats';
import { computeStreak, type Streak } from './streaks';
import type { Session } from './types';

export interface Progress {
  loggedMinutes: number;
  minutesToday: number;
  byDay: Map<DayKey, number>;
  /** Days on which the daily goal was reached. */
  completedDays: Set<DayKey>;
  goalMetToday: boolean;
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
  dailyGoalMinutes: number,
  today: DayKey,
): Progress {
  const loggedMinutes = totalMinutes(sessions);
  const byDay = minutesByDay(sessions);
  const pace = dailyPace(byDay, today);
  // A day only counts towards the streak once the daily goal is reached.
  const completedDays = new Set(
    [...byDay].filter(([, minutes]) => minutes >= dailyGoalMinutes).map(([day]) => day),
  );

  return {
    loggedMinutes,
    minutesToday: byDay.get(today) ?? 0,
    byDay,
    completedDays,
    goalMetToday: completedDays.has(today),
    streak: computeStreak(completedDays, today),
    pace,
    finishDay: projectFinish(loggedMinutes, targetHours, pace, today),
    nextMilestoneHours: nextMilestone(loggedMinutes, targetHours),
  };
}
