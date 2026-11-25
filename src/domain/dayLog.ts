import type { DayKey } from './dates';
import type { Session, Skill } from './types';

export interface DayLogEntry {
  session: Session;
  skill: Pick<Skill, 'id' | 'name' | 'icon' | 'color' | 'kind'>;
}

export interface DayLog {
  /** Newest first. */
  entries: DayLogEntry[];
  totalMinutes: number;
}

/**
 * What was worked on during `day`: every session counted towards it, with
 * the skill, habit or project it belongs to. Sessions of deleted trackers
 * are left out, as they are everywhere else.
 */
export function buildDayLog(
  sessions: readonly Session[],
  skills: readonly Skill[],
  day: DayKey,
): DayLog {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const entries = sessions
    .filter((session) => session.day === day && byId.has(session.skillId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((session) => ({ session, skill: byId.get(session.skillId) as Skill }));
  return {
    entries,
    totalMinutes: entries.reduce((sum, { session }) => sum + session.minutes, 0),
  };
}
