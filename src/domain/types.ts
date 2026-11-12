import type { DayKey } from './dates';

export type SkillId = string;
export type SessionId = string;

/**
 * What is being tracked. A skill counts hours towards a long-term target; a
 * habit is about showing up every day and has no target.
 */
export type TrackerKind = 'skill' | 'habit';

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
  /** Planned length of a countdown, or null for an open-ended stopwatch. */
  durationMinutes: number | null;
}

export type Theme = 'system' | 'light' | 'dark';

export const SKILL_COLORS = ['cobalt', 'persimmon', 'moss', 'plum', 'teal', 'rose'] as const;
export type SkillColor = (typeof SKILL_COLORS)[number];

export const DEFAULT_TARGET_HOURS = 10_000;
export const DEFAULT_DAILY_GOAL_MINUTES = 60;
export const DEFAULT_ICONS: Record<TrackerKind, string> = { skill: '🎯', habit: '🌱' };

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
