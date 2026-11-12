const MILESTONE_HOURS = [1, 10, 20, 50, 100, 250, 500, 1000, 2500, 5000, 7500, 10_000];

/** Milestones up to and including the target, which is always the last one. */
export function milestonesFor(targetHours: number): number[] {
  const below = MILESTONE_HOURS.filter((hours) => hours < targetHours);
  return [...below, targetHours];
}

const STREAK_MILESTONE_DAYS = [3, 7, 14, 30, 60, 100, 200, 365];

export interface Milestone {
  label: string;
  reached: boolean;
}

export function hourMilestones(loggedMinutes: number, targetHours: number): Milestone[] {
  return milestonesFor(targetHours).map((hours) => ({
    label: `${hours.toLocaleString()}h`,
    reached: loggedMinutes >= hours * 60,
  }));
}

/** Habit milestones, earned by the longest streak ever held. */
export function streakMilestones(longestStreak: number): Milestone[] {
  return STREAK_MILESTONE_DAYS.map((days) => ({
    label: `${days} days`,
    reached: longestStreak >= days,
  }));
}

export function nextMilestone(loggedMinutes: number, targetHours: number): number | null {
  return milestonesFor(targetHours).find((hours) => hours * 60 > loggedMinutes) ?? null;
}
