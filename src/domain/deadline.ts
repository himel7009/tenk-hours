/** How close a deadline is: past it, on it or within two days, or further off. */
export type DeadlineTone = 'overdue' | 'soon' | 'later';

export const DEADLINE_SOON_DAYS = 2;

export interface DeadlineWords {
  text: string;
  tone: DeadlineTone;
}

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/**
 * A deadline in words, shared by to-dos and the library. `daysLeft` counts
 * from today (or from the day it was done) to the deadline: 0 on the day,
 * negative once passed. Open: "3 days left", "Due tomorrow", "Due today",
 * "2 days overdue". Done: "Done 2 days early", "Done on its deadline", "Done
 * 1 day late".
 */
export function describeDaysLeft(daysLeft: number | null, done: boolean): DeadlineWords | null {
  if (daysLeft === null) return null;
  if (done) {
    if (daysLeft > 0) return { text: `Done ${days(daysLeft)} early`, tone: 'later' };
    if (daysLeft === 0) return { text: 'Done on its deadline', tone: 'later' };
    return { text: `Done ${days(-daysLeft)} late`, tone: 'overdue' };
  }
  if (daysLeft < 0) return { text: `${days(-daysLeft)} overdue`, tone: 'overdue' };
  if (daysLeft === 0) return { text: 'Due today', tone: 'soon' };
  if (daysLeft === 1) return { text: 'Due tomorrow', tone: 'soon' };
  return {
    text: `${days(daysLeft)} left`,
    tone: daysLeft <= DEADLINE_SOON_DAYS ? 'soon' : 'later',
  };
}
