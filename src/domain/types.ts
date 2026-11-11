import type { DayKey } from './dates';

export type SkillId = string;
export type SessionId = string;

export interface Skill {
  id: SkillId;
  name: string;
  /** Key into SKILL_COLORS. */
  color: SkillColor;
  targetHours: number;
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
}

export type Theme = 'system' | 'light' | 'dark';

export const SKILL_COLORS = ['cobalt', 'persimmon', 'moss', 'plum', 'teal', 'rose'] as const;
export type SkillColor = (typeof SKILL_COLORS)[number];

export const DEFAULT_TARGET_HOURS = 10_000;
