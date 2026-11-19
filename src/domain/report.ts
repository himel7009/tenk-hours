import { summarizeBadHabit, type BadHabit, type CheckIn } from './badHabits';
import { addDays, daysBetween, fromDayKey, toDayKey, type DayKey } from './dates';
import type { Domain } from './domains';
import { hasDailyGoal, type Session, type Skill, type SkillId } from './types';

export type PeriodKind = 'week' | 'month';

/** A calendar week (Monday to Sunday) or month. Both ends are included. */
export interface Period {
  kind: PeriodKind;
  start: DayKey;
  end: DayKey;
}

export function periodContaining(kind: PeriodKind, day: DayKey): Period {
  const date = fromDayKey(day);
  if (kind === 'week') {
    // getDay() is 0 for Sunday; weeks here start on Monday.
    const start = addDays(day, -((date.getDay() + 6) % 7));
    return { kind, start, end: addDays(start, 6) };
  }
  const start = toDayKey(new Date(date.getFullYear(), date.getMonth(), 1, 12));
  const end = toDayKey(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12));
  return { kind, start, end };
}

/** The period `steps` before (negative) or after (positive) this one. */
export function shiftPeriod(period: Period, steps: number): Period {
  if (period.kind === 'week') return periodContaining('week', addDays(period.start, steps * 7));
  const date = fromDayKey(period.start);
  return periodContaining(
    'month',
    toDayKey(new Date(date.getFullYear(), date.getMonth() + steps, 1, 12)),
  );
}

export function periodDays(period: Period): DayKey[] {
  const length = daysBetween(period.start, period.end) + 1;
  return Array.from({ length }, (_, index) => addDays(period.start, index));
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export interface ReportDay {
  day: DayKey;
  minutes: number;
  /** After today, so nothing can have been logged yet. */
  future: boolean;
  segments: { skill: Skill; minutes: number }[];
}

export interface TrackerReport {
  skill: Skill;
  minutes: number;
  /** Over the same stretch of the period before. */
  previousMinutes: number;
  sessions: number;
  /** Days the daily goal was reached, and the days it could have been. Null for projects. */
  goal: { met: number; possible: number } | null;
}

export interface DomainReport {
  domain: Domain;
  minutes: number;
  previousMinutes: number;
}

export interface BadHabitReport {
  habit: BadHabit;
  clean: number;
  slipped: number;
  /** Days so far in the period with no answer. */
  unanswered: number;
}

export interface Report {
  period: Period;
  /** Days of the period up to today: all of them once it is over. */
  elapsedDays: number;
  /** Whether today falls inside the period. */
  inProgress: boolean;
  totalMinutes: number;
  /**
   * The period before, cut to the same number of days while this one is
   * still running, so a Wednesday is compared with last Wednesday.
   */
  previousMinutes: number;
  days: ReportDay[];
  activeDays: number;
  bestDay: { day: DayKey; minutes: number } | null;
  sessionCount: number;
  longestSession: { minutes: number; skill: Skill; day: DayKey } | null;
  /** Daily goals reached across all skills and habits. */
  goals: { met: number; possible: number };
  trackers: TrackerReport[];
  domains: DomainReport[];
  badHabits: BadHabitReport[];
}

export interface ReportInput {
  skills: readonly Skill[];
  sessions: readonly Session[];
  domains: readonly Domain[];
  badHabits: readonly BadHabit[];
  checkIns: readonly CheckIn[];
}

/** How the period went, against the one before it. */
export function buildReport(input: ReportInput, period: Period, today: DayKey): Report {
  const days = periodDays(period);
  const inProgress = period.start <= today && today <= period.end;
  const elapsed = days.filter((day) => day <= today);
  const previous = shiftPeriod(period, -1);
  // While a period runs, compare like with like: its first N days.
  const previousEnd = inProgress
    ? minDay(addDays(previous.start, elapsed.length - 1), previous.end)
    : previous.end;

  const skillById = new Map(input.skills.map((skill) => [skill.id, skill]));
  const inPeriod = input.sessions.filter(
    (session) =>
      session.day >= period.start && session.day <= period.end && skillById.has(session.skillId),
  );
  const inPrevious = input.sessions.filter(
    (session) =>
      session.day >= previous.start && session.day <= previousEnd && skillById.has(session.skillId),
  );

  // minutes[skill][day]
  const grid = new Map<SkillId, Map<DayKey, number>>();
  for (const session of inPeriod) {
    const byDay = grid.get(session.skillId) ?? new Map<DayKey, number>();
    byDay.set(session.day, (byDay.get(session.day) ?? 0) + session.minutes);
    grid.set(session.skillId, byDay);
  }

  const reportDays: ReportDay[] = days.map((day) => {
    const segments = input.skills
      .map((skill) => ({ skill, minutes: grid.get(skill.id)?.get(day) ?? 0 }))
      .filter((segment) => segment.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
    return { day, future: day > today, segments, minutes: sum(segments.map((s) => s.minutes)) };
  });

  const trackers: TrackerReport[] = input.skills
    .map((skill) => {
      const byDay = grid.get(skill.id) ?? new Map<DayKey, number>();
      const minutes = sum([...byDay.values()]);
      const previousMinutes = sum(
        inPrevious.filter((s) => s.skillId === skill.id).map((s) => s.minutes),
      );
      let goal: TrackerReport['goal'] = null;
      if (hasDailyGoal(skill.kind)) {
        const met = [...byDay].filter(
          ([day, total]) => day <= today && total >= skill.dailyGoalMinutes,
        ).length;
        const created = toDayKey(new Date(skill.createdAt));
        const possible = elapsed.filter((day) => day >= created).length;
        // Time logged before the skill was created still counts.
        goal = { met, possible: Math.max(possible, met) };
      }
      return {
        skill,
        minutes,
        previousMinutes,
        sessions: inPeriod.filter((s) => s.skillId === skill.id).length,
        goal,
      };
    })
    .filter(
      (tracker) =>
        tracker.minutes > 0 || tracker.previousMinutes > 0 || (tracker.goal?.possible ?? 0) > 0,
    )
    .sort((a, b) => b.minutes - a.minutes || a.skill.name.localeCompare(b.skill.name));

  const domains: DomainReport[] = input.domains
    .map((domain) => {
      const members = trackers.filter((tracker) => tracker.skill.domainId === domain.id);
      return {
        domain,
        minutes: sum(members.map((m) => m.minutes)),
        previousMinutes: sum(members.map((m) => m.previousMinutes)),
      };
    })
    .filter((domain) => domain.minutes > 0 || domain.previousMinutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const badHabits: BadHabitReport[] = input.badHabits.map((habit) => {
    const { byDay } = summarizeBadHabit(
      input.checkIns.filter((checkIn) => checkIn.habitId === habit.id),
      today,
    );
    const created = toDayKey(new Date(habit.createdAt));
    const answered = elapsed.map((day) => byDay.get(day));
    const clean = answered.filter((status) => status === 'clean').length;
    const slipped = answered.filter((status) => status === 'slipped').length;
    const possible = elapsed.filter((day) => day >= created).length;
    return { habit, clean, slipped, unanswered: Math.max(0, possible - clean - slipped) };
  });

  const best = reportDays.reduce<ReportDay | null>(
    (top, day) => (day.minutes > (top?.minutes ?? 0) ? day : top),
    null,
  );
  const longest = inPeriod.reduce<Session | null>(
    (top, session) => (session.minutes > (top?.minutes ?? 0) ? session : top),
    null,
  );
  const goalTrackers = trackers.filter((tracker) => tracker.goal);

  return {
    period,
    elapsedDays: elapsed.length,
    inProgress,
    totalMinutes: sum(reportDays.map((day) => day.minutes)),
    previousMinutes: sum(inPrevious.map((session) => session.minutes)),
    days: reportDays,
    activeDays: reportDays.filter((day) => day.minutes > 0).length,
    bestDay: best ? { day: best.day, minutes: best.minutes } : null,
    sessionCount: inPeriod.length,
    longestSession:
      longest && skillById.get(longest.skillId)
        ? { minutes: longest.minutes, skill: skillById.get(longest.skillId)!, day: longest.day }
        : null,
    goals: {
      met: sum(goalTrackers.map((tracker) => tracker.goal!.met)),
      possible: sum(goalTrackers.map((tracker) => tracker.goal!.possible)),
    },
    trackers,
    domains,
    badHabits,
  };
}

export interface TrendPoint {
  period: Period;
  minutes: number;
}

/** Total time for `count` periods ending with `period`, oldest first. */
export function buildTrend(
  sessions: readonly Session[],
  period: Period,
  count: number,
): TrendPoint[] {
  const periods = Array.from({ length: count }, (_, index) =>
    shiftPeriod(period, index - count + 1),
  );
  return periods.map((p) => ({
    period: p,
    minutes: sum(sessions.filter((s) => s.day >= p.start && s.day <= p.end).map((s) => s.minutes)),
  }));
}

function minDay(a: DayKey, b: DayKey): DayKey {
  return a < b ? a : b;
}
