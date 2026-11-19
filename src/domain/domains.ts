import type { DayKey } from './dates';
import { summarizeProgress } from './progress';
import { isPlannedOn, type Weekday } from './routine';
import { computeStreak, type Streak } from './streaks';
import {
  hasDailyGoal,
  keepsStreak,
  type Session,
  type Skill,
  type SkillColor,
  type SkillId,
} from './types';

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
  /** Weekdays the domain is studied on; empty is every day. Its skills follow it. */
  routineDays: Weekday[];
  createdAt: number;
}

export const DEFAULT_DOMAIN_ICON = '🧭';

export interface DomainShare {
  skill: Skill;
  minutes: number;
}

/** One skill's part of the domain's daily plan. */
export interface PlanItem {
  skill: Skill;
  goalMinutes: number;
  minutesToday: number;
  done: boolean;
}

/**
 * The time the domain asks for each day: every skill's daily goal added up.
 * Projects have no goal, so they are not part of it.
 */
export interface DailyPlan {
  items: PlanItem[];
  /** All the daily goals together. */
  totalMinutes: number;
  /**
   * Today's time towards the plan. Each skill counts only up to its own goal,
   * so extra time on one skill cannot make up for another left untouched.
   */
  coveredMinutes: number;
  /** Skills that reached their goal today. */
  doneCount: number;
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
  /** Whether any skill in it keeps a streak. Without one the domain shows none. */
  keepsStreak: boolean;
  /** Whether today is on the domain's routine. */
  plannedToday: boolean;
  plan: DailyPlan;
}

/**
 * Rolls the skills of a domain up into one summary. A day counts towards the
 * domain's streak when any one of its streak-keeping skills reached its daily
 * goal that day. Days off the domain's routine carry the streak over, and on
 * those days its plan is empty.
 */
export function summarizeDomain(
  skills: readonly Skill[],
  sessions: readonly Session[],
  today: DayKey,
  routine: readonly Weekday[] = [],
): DomainProgress {
  const plannedToday = isPlannedOn(routine, today);
  const bySkill = new Map<SkillId, Session[]>(skills.map((skill) => [skill.id, []]));
  for (const session of sessions) bySkill.get(session.skillId)?.push(session);

  const completedDays = new Set<DayKey>();
  const activeDays = new Set<DayKey>();
  let minutesToday = 0;
  const planItems: PlanItem[] = [];

  const shares = skills.map((skill) => {
    const progress = summarizeProgress(
      bySkill.get(skill.id) ?? [],
      skill.targetHours,
      skill.dailyGoalMinutes,
      today,
      routine,
    );
    if (hasDailyGoal(skill) && keepsStreak(skill)) {
      for (const day of progress.completedDays) completedDays.add(day);
    }
    for (const day of progress.byDay.keys()) activeDays.add(day);
    minutesToday += progress.minutesToday;
    if (hasDailyGoal(skill) && plannedToday) {
      planItems.push({
        skill,
        goalMinutes: skill.dailyGoalMinutes,
        minutesToday: progress.minutesToday,
        done: progress.goalMetToday,
      });
    }
    return { skill, minutes: progress.loggedMinutes };
  });

  return {
    loggedMinutes: shares.reduce((sum, share) => sum + share.minutes, 0),
    minutesToday,
    shares,
    completedDays,
    activeDays,
    streak: computeStreak(completedDays, today, (day) => !isPlannedOn(routine, day)),
    keepsStreak: skills.some((skill) => hasDailyGoal(skill) && keepsStreak(skill)),
    plannedToday,
    plan: {
      items: planItems,
      totalMinutes: planItems.reduce((sum, item) => sum + item.goalMinutes, 0),
      coveredMinutes: planItems.reduce(
        (sum, item) => sum + Math.min(item.minutesToday, item.goalMinutes),
        0,
      ),
      doneCount: planItems.filter((item) => item.done).length,
    },
  };
}
