const MILESTONE_HOURS = [1, 10, 20, 50, 100, 250, 500, 1000, 2500, 5000, 7500, 10_000];

/** Milestones up to and including the target, which is always the last one. */
export function milestonesFor(targetHours: number): number[] {
  const below = MILESTONE_HOURS.filter((hours) => hours < targetHours);
  return [...below, targetHours];
}

export function nextMilestone(loggedMinutes: number, targetHours: number): number | null {
  return milestonesFor(targetHours).find((hours) => hours * 60 > loggedMinutes) ?? null;
}
