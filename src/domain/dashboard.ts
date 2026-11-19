import { addDays, type DayKey } from './dates';
import { summarizeProgress, type Progress } from './progress';
import type { Domain } from './domains';
import { routineOf } from './routine';
import { hasDailyGoal, keepsStreak, type Session, type Skill, type SkillId } from './types';

export interface TrackerSummary {
  skill: Skill;
  progress: Progress;
}

export interface DayBar {
  day: DayKey;
  minutes: number;
  /** The day's time split by skill or habit, largest first. */
  segments: { skill: Skill; minutes: number }[];
}

export interface Dashboard {
  trackers: TrackerSummary[];
  minutesToday: number;
  /** Time across everything, ever. */
  totalMinutes: number;
  /** The last seven days, oldest first, ending today. */
  week: DayBar[];
  weekMinutes: number;
  /** The seven days before those, for comparison. */
  previousWeekMinutes: number;
  /** The longest streak currently running, if any. */
  bestStreak: { days: number; skill: Skill } | null;
}

/** Everything the home page shows, derived in one pass over the sessions. */
export function summarizeDashboard(
  skills: readonly Skill[],
  sessions: readonly Session[],
  today: DayKey,
  domains: readonly Domain[] = [],
): Dashboard {
  const bySkill = new Map<SkillId, Session[]>(skills.map((skill) => [skill.id, []]));
  for (const session of sessions) bySkill.get(session.skillId)?.push(session);

  const trackers = skills.map((skill) => ({
    skill,
    progress: summarizeProgress(
      bySkill.get(skill.id) ?? [],
      skill.targetHours,
      skill.dailyGoalMinutes,
      today,
      routineOf(skill, domains),
    ),
  }));

  const minutesOn = (day: DayKey) =>
    trackers
      .map(({ skill, progress }) => ({ skill, minutes: progress.byDay.get(day) ?? 0 }))
      .filter((segment) => segment.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);

  const span = (endOffset: number) =>
    Array.from({ length: 7 }, (_, index) => {
      const day = addDays(today, index - 6 - endOffset);
      const segments = minutesOn(day);
      return { day, segments, minutes: sum(segments.map((segment) => segment.minutes)) };
    });

  const week = span(0);
  const running = trackers
    .filter(
      ({ skill, progress }) =>
        hasDailyGoal(skill) && keepsStreak(skill) && progress.streak.current > 0,
    )
    .sort((a, b) => b.progress.streak.current - a.progress.streak.current)[0];

  return {
    trackers,
    minutesToday: week[6]?.minutes ?? 0,
    totalMinutes: sum(trackers.map(({ progress }) => progress.loggedMinutes)),
    week,
    weekMinutes: sum(week.map((bar) => bar.minutes)),
    previousWeekMinutes: sum(span(7).map((bar) => bar.minutes)),
    bestStreak: running ? { days: running.progress.streak.current, skill: running.skill } : null,
  };
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
