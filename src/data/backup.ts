import { isDayKey } from '../domain/dates';
import { isWebUrl, UNITS_FOR_KIND, type LibraryItem, type LibraryKind } from '../domain/library';
import {
  DEFAULT_DAILY_GOAL_MINUTES,
  DEFAULT_ICONS,
  SKILL_COLORS,
  type Session,
  type Skill,
  type SkillColor,
  type TrackerKind,
} from '../domain/types';

export const BACKUP_VERSION = 3;

export interface Backup {
  app: 'tenk';
  version: number;
  exportedAt: string;
  skills: Skill[];
  sessions: Session[];
  library: LibraryItem[];
}

export type BackupData = Pick<Backup, 'skills' | 'sessions' | 'library'>;

export class BackupError extends Error {}

export function createBackup(data: BackupData, now = new Date()): Backup {
  return { app: 'tenk', version: BACKUP_VERSION, exportedAt: now.toISOString(), ...data };
}

/**
 * Validates untrusted JSON from a backup file. Throws BackupError with a
 * message that can be shown to the user as-is.
 */
export function parseBackup(json: string): BackupData {
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
  // Backups from before the library existed simply have none.
  const library = Array.isArray(raw.library) ? raw.library.map(parseLibraryItem) : [];
  return { skills, sessions, library };
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
  // Backups from before habits existed have none of the newer fields.
  const kind: TrackerKind = value.kind === 'habit' ? 'habit' : 'skill';
  return {
    id: value.id,
    kind,
    name: value.name,
    icon: typeof value.icon === 'string' && value.icon !== '' ? value.icon : DEFAULT_ICONS[kind],
    color: isSkillColor(value.color) ? value.color : SKILL_COLORS[0],
    targetHours: value.targetHours,
    dailyGoalMinutes: isPositive(value.dailyGoalMinutes)
      ? Math.round(value.dailyGoalMinutes)
      : DEFAULT_DAILY_GOAL_MINUTES,
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

function parseLibraryItem(value: unknown): LibraryItem {
  if (!isRecord(value) || !isUuid(value.id) || typeof value.title !== 'string') {
    throw new BackupError('This backup contains a book or course that cannot be read.');
  }
  const kind: LibraryKind = value.kind === 'course' ? 'course' : 'book';
  const units = UNITS_FOR_KIND[kind];
  const text = (field: unknown) => (typeof field === 'string' ? field : '');
  return {
    id: value.id,
    kind,
    title: value.title,
    author: text(value.author),
    url: isWebUrl(text(value.url)) ? text(value.url) : '',
    unit: units.find((unit) => unit === value.unit) ?? units[0]!,
    totalUnits: isPositive(value.totalUnits) ? Math.round(value.totalUnits) : null,
    doneUnits: isPositive(value.doneUnits) ? Math.round(value.doneUnits) : 0,
    position: text(value.position),
    notes: text(value.notes),
    status: value.status === 'done' || value.status === 'paused' ? value.status : 'active',
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
