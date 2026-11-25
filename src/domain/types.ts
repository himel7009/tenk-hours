import type { Weekday } from './routine';
import type { PomodoroState } from './pomodoro';
import type { DayKey } from './dates';

export type SkillId = string;
export type SessionId = string;

/**
 * What is being tracked. A skill counts hours towards a long-term target; a
 * habit is about showing up every day and has no target; a project only adds
 * up the time spent on it, with no target, daily goal or streak.
 */
export type TrackerKind = 'skill' | 'habit' | 'project';

/** Whether this kind has a daily goal, and so a streak. Projects do not. */
/**
 * Whether a tracker has a daily goal. Skills and habits always do; a project
 * gets one only when it keeps a streak.
 */
export const hasDailyGoal = (skill: Pick<Skill, 'kind' | 'keepStreak'>): boolean =>
  skill.kind !== 'project' || skill.keepStreak;

/** Whether a tracker shows and counts a streak. It is a choice per tracker. */
export const keepsStreak = (skill: Pick<Skill, 'keepStreak'>): boolean => skill.keepStreak;

/** Whether this kind can be grouped under a domain. Habits cannot. */
export const canJoinDomain = (kind: TrackerKind): boolean => kind !== 'habit';

/**
 * A tracked skill or habit. The name predates habits: both kinds share this
 * shape, the `skills` table and all session logic, and differ only in `kind`.
 */
export interface Skill {
  id: SkillId;
  kind: TrackerKind;
  name: string;
  /** An emoji shown next to the name. */
  icon: string;
  /** A name from SKILL_COLORS or a custom hex code. */
  color: SkillColor;
  /** Total hours aimed for. Only meaningful for skills. */
  targetHours: number;
  /** Minutes needed in a day for that day to count towards the streak. */
  dailyGoalMinutes: number;
  /** The domain this skill is grouped under, or null if it stands alone. */
  domainId: string | null;
  /**
   * Whether to count a streak. Off, the tracker still adds up time and keeps
   * its daily goal, but shows no streak. On a project it also turns on the
   * daily goal.
   */
  keepStreak: boolean;
  /**
   * Weekdays it is planned for; empty is every day. Ignored while it is in a
   * domain, which plans for all its skills (`routineOf`).
   */
  routineDays: Weekday[];
  /**
   * Single days changed from the routine: added on top of it, or skipped.
   * Used only where the routine is (a domain, or a tracker outside one).
   */
  addedDays?: DayKey[];
  skippedDays?: DayKey[];
  createdAt: number;
}

export interface Session {
  id: SessionId;
  skillId: SkillId;
  /** Local calendar day the time counts towards. */
  day: DayKey;
  minutes: number;
  note: string;
  source: 'timer' | 'manual';
  createdAt: number;
}

export interface ActiveTimer {
  skillId: SkillId;
  startedAt: number;
  /** Planned length of a countdown in seconds, or null for an open-ended stopwatch. */
  durationSeconds: number | null;
  /** When the timer was paused, or null while it is running. */
  pausedAt: number | null;
  /** Total length of earlier pauses, left out of the time spent. */
  pausedMs: number;
  /** Rounds and breaks, when the countdown is split Pomodoro style. */
  pomodoro: PomodoroState | null;
}

export type Theme = 'system' | 'light' | 'dark';

/** How panels look: plain, or see-through frosted glass over a colour field. */
export type SurfaceStyle = 'solid' | 'glass';

/**
 * The named colours, in the order new items are given them, so neighbours in
 * a list look as different as possible. Each has light and dark values in
 * tokens.css.
 */
export const SKILL_COLORS = [
  'cobalt',
  'persimmon',
  'moss',
  'plum',
  'teal',
  'rose',
  'gold',
  'indigo',
  'olive',
  'fuchsia',
  'sky',
  'cocoa',
] as const;
export type NamedColor = (typeof SKILL_COLORS)[number];
/** A named colour, or a custom one as a lowercase hex code such as #1f8a70. */
export type SkillColor = NamedColor | `#${string}`;

const HEX_COLOR = /^#[0-9a-f]{6}$/;

/** Whether a value is a colour the app can show. The database checks the same. */
export function isSkillColor(value: unknown): value is SkillColor {
  return (
    typeof value === 'string' &&
    (SKILL_COLORS.includes(value as NamedColor) || HEX_COLOR.test(value))
  );
}

export function isCustomColor(color: SkillColor): color is `#${string}` {
  return HEX_COLOR.test(color);
}

export const DEFAULT_TARGET_HOURS = 10_000;
export const DEFAULT_DAILY_GOAL_MINUTES = 60;
export const DEFAULT_ICONS: Record<TrackerKind, string> = {
  skill: '🎯',
  habit: '🌱',
  project: '🛠️',
};
