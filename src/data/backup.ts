import { isDayKey } from '../domain/dates';
import { SKILL_COLORS, type Session, type Skill, type SkillColor } from '../domain/types';

export const BACKUP_VERSION = 1;

export interface Backup {
  app: 'tenk';
  version: number;
  exportedAt: string;
  skills: Skill[];
  sessions: Session[];
}

export class BackupError extends Error {}

export function createBackup(skills: Skill[], sessions: Session[], now = new Date()): Backup {
  return { app: 'tenk', version: BACKUP_VERSION, exportedAt: now.toISOString(), skills, sessions };
}

/**
 * Validates untrusted JSON from a backup file. Throws BackupError with a
 * message that can be shown to the user as-is.
 */
export function parseBackup(json: string): Pick<Backup, 'skills' | 'sessions'> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new BackupError('This file is not valid JSON.');
  }

  if (!isRecord(raw) || raw.app !== 'tenk') {
    throw new BackupError('This file is not a Tenk backup.');
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    throw new BackupError('This backup was made by a newer version of Tenk.');
  }
  if (!Array.isArray(raw.skills) || !Array.isArray(raw.sessions)) {
    throw new BackupError('This backup is missing its skills or sessions.');
  }

  const skills = raw.skills.map(parseSkill);
  const skillIds = new Set(skills.map((skill) => skill.id));
  const sessions = raw.sessions.map(parseSession).filter((s) => skillIds.has(s.skillId));
  return { skills, sessions };
}

function parseSkill(value: unknown): Skill {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    typeof value.name !== 'string' ||
    !isPositive(value.targetHours)
  ) {
    throw new BackupError('This backup contains a skill that cannot be read.');
  }
  return {
    id: value.id,
    name: value.name,
    color: isSkillColor(value.color) ? value.color : SKILL_COLORS[0],
    targetHours: value.targetHours,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  };
}

function parseSession(value: unknown): Session {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    !isUuid(value.skillId) ||
    !isDayKey(value.day) ||
    !isPositive(value.minutes)
  ) {
    throw new BackupError('This backup contains a session that cannot be read.');
  }
  return {
    id: value.id,
    skillId: value.skillId,
    day: value.day,
    minutes: Math.round(value.minutes),
    note: typeof value.note === 'string' ? value.note : '',
    source: value.source === 'timer' ? 'timer' : 'manual',
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Ids double as primary keys in the cloud database, which only takes UUIDs.
const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const isPositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isSkillColor = (value: unknown): value is SkillColor =>
  SKILL_COLORS.includes(value as SkillColor);
