import type { DayKey } from './dates';
import { summarizeProgress } from './progress';
import { computeStreak, type Streak } from './streaks';
import { hasDailyGoal, type Session, type Skill, type SkillColor, type SkillId } from './types';

export type DomainId = string;

/**
 * A named group of skills, such as "AI" holding machine learning and deep
 * learning. It stores nothing about progress: hours and streak are always
 * derived from the skills inside it.
 */
export interface Domain {
  id: DomainId;
  name: string;
  icon: string;
  color: SkillColor;
  createdAt: number;
}

export const DEFAULT_DOMAIN_ICON = '🧭';

export interface DomainShare {
  skill: Skill;
  minutes: number;
}

export interface DomainProgress {
  /** Time across every skill in the domain. */
  loggedMinutes: number;
  minutesToday: number;
  /** Each skill's contribution, in the order the skills were given. */
  shares: DomainShare[];
  /** Days on which at least one skill reached its own daily goal. Projects have none. */
  completedDays: Set<DayKey>;
  /** Days with any time logged in the domain. */
  activeDays: Set<DayKey>;
  streak: Streak;
}

/**
 * Rolls the skills of a domain up into one summary. A day counts towards the
 * domain's streak when any one of its skills reached its daily goal that day.
 */
export function summarizeDomain(
  skills: readonly Skill[],
  sessions: readonly Session[],
  today: DayKey,
): DomainProgress {
  const bySkill = new Map<SkillId, Session[]>(skills.map((skill) => [skill.id, []]));
  for (const session of sessions) bySkill.get(session.skillId)?.push(session);

  const completedDays = new Set<DayKey>();
  const activeDays = new Set<DayKey>();
  let minutesToday = 0;

  const shares = skills.map((skill) => {
    const progress = summarizeProgress(
      bySkill.get(skill.id) ?? [],
      skill.targetHours,
      skill.dailyGoalMinutes,
      today,
    );
    if (hasDailyGoal(skill.kind)) {
      for (const day of progress.completedDays) completedDays.add(day);
    }
    for (const day of progress.byDay.keys()) activeDays.add(day);
    minutesToday += progress.minutesToday;
    return { skill, minutes: progress.loggedMinutes };
  });

  return {
    loggedMinutes: shares.reduce((sum, share) => sum + share.minutes, 0),
    minutesToday,
    shares,
    completedDays,
    activeDays,
    streak: computeStreak(completedDays, today),
  };
}
