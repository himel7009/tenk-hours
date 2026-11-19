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
export const hasDailyGoal = (kind: TrackerKind): boolean => kind !== 'project';

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
  /** Key into SKILL_COLORS. */
  color: SkillColor;
  /** Total hours aimed for. Only meaningful for skills. */
  targetHours: number;
  /** Minutes needed in a day for that day to count towards the streak. */
  dailyGoalMinutes: number;
  /** The domain this skill is grouped under, or null if it stands alone. */
  domainId: string | null;
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

export const SKILL_COLORS = ['cobalt', 'persimmon', 'moss', 'plum', 'teal', 'rose'] as const;
export type SkillColor = (typeof SKILL_COLORS)[number];

export const DEFAULT_TARGET_HOURS = 10_000;
export const DEFAULT_DAILY_GOAL_MINUTES = 60;
export const DEFAULT_ICONS: Record<TrackerKind, string> = {
  skill: '🎯',
  habit: '🌱',
  project: '🛠️',
};

/** Emoji offered when creating a skill or habit. */
export const ICON_CHOICES = [
  '🎯',
  '💻',
  '🐍',
  '🧠',
  '🤖',
  '📊',
  '🧮',
  '🔬',
  '📚',
  '✍️',
  '🗣️',
  '🌍',
  '🎨',
  '✏️',
  '📷',
  '🎬',
  '🎹',
  '🎸',
  '🎤',
  '♟️',
  '🏃',
  '🏋️',
  '🧘',
  '🚴',
  '🏊',
  '⚽',
  '🌱',
  '💧',
  '😴',
  '🍳',
  '🧹',
  '🙏',
] as const;
