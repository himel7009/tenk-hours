import { DEBT_PERSON_MAX, type Debt, type DebtPayment } from '../domain/debts';
import { normalizeDayList, normalizeRoutine } from '../domain/routine';
import { cleanNote, MONEY_AMOUNT_MAX, type MoneyEntry, type MoneySection } from '../domain/money';
import { cleanTodoTitle, type Todo } from '../domain/todos';
import { isDayKey, toDayKey } from '../domain/dates';
import { checkInId, type BadHabit, type CheckIn } from '../domain/badHabits';
import type { Domain } from '../domain/domains';
import {
  isWebUrl,
  LIBRARY_STATUSES,
  UNITS_FOR_KIND,
  type LibraryItem,
  type LibraryKind,
} from '../domain/library';
import {
  DEFAULT_DAILY_GOAL_MINUTES,
  DEFAULT_ICONS,
  SKILL_COLORS,
  isSkillColor,
  type Session,
  type Skill,
  type TrackerKind,
} from '../domain/types';

export const BACKUP_VERSION = 5;

export interface Backup {
  app: 'tenk';
  version: number;
  exportedAt: string;
  skills: Skill[];
  sessions: Session[];
  library: LibraryItem[];
  domains: Domain[];
  badHabits: BadHabit[];
  checkIns: CheckIn[];
  todos: Todo[];
  moneySections: MoneySection[];
  moneyEntries: MoneyEntry[];
  debts: Debt[];
  debtPayments: DebtPayment[];
}

export type BackupData = Pick<
  Backup,
  | 'skills'
  | 'sessions'
  | 'library'
  | 'domains'
  | 'badHabits'
  | 'checkIns'
  | 'todos'
  | 'moneySections'
  | 'moneyEntries'
  | 'debts'
  | 'debtPayments'
>;

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

  // Backups from before domains existed have none, and no skill refers to one.
  const domains = Array.isArray(raw.domains) ? raw.domains.map(parseDomain) : [];
  const domainIds = new Set(domains.map((domain) => domain.id));
  const skills = raw.skills
    .map(parseSkill)
    .map((skill) =>
      skill.domainId !== null && !domainIds.has(skill.domainId)
        ? { ...skill, domainId: null }
        : skill,
    );
  const skillIds = new Set(skills.map((skill) => skill.id));
  const sessions = raw.sessions.map(parseSession).filter((s) => skillIds.has(s.skillId));
  // Backups from before the library existed simply have none.
  const library = Array.isArray(raw.library) ? raw.library.map(parseLibraryItem) : [];
  // Backups from before bad habits existed have none.
  const badHabits = Array.isArray(raw.badHabits) ? raw.badHabits.map(parseBadHabit) : [];
  const habitIds = new Set(badHabits.map((habit) => habit.id));
  const checkIns = Array.isArray(raw.checkIns)
    ? raw.checkIns.map(parseCheckIn).filter((checkIn) => habitIds.has(checkIn.habitId))
    : [];
  // Backups from before to-dos existed have none.
  const todos = Array.isArray(raw.todos) ? raw.todos.map(parseTodo) : [];
  // Backups from before money existed have none.
  const moneySections = Array.isArray(raw.moneySections)
    ? raw.moneySections.map(parseMoneySection)
    : [];
  const sectionIds = new Set(moneySections.map((section) => section.id));
  const moneyEntries = Array.isArray(raw.moneyEntries)
    ? raw.moneyEntries.map((value) => parseMoneyEntry(value, sectionIds))
    : [];
  // Backups from before debts existed have none.
  const debts = Array.isArray(raw.debts) ? raw.debts.map(parseDebt) : [];
  const debtIds = new Set(debts.map((debt) => debt.id));
  const debtPayments = Array.isArray(raw.debtPayments)
    ? raw.debtPayments.map((value) => parseDebtPayment(value, debtIds))
    : [];
  return {
    skills,
    sessions,
    library,
    domains,
    badHabits,
    checkIns,
    todos,
    moneySections,
    moneyEntries,
    debts,
    debtPayments,
  };
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
  const kind: TrackerKind =
    value.kind === 'habit' || value.kind === 'project' ? value.kind : 'skill';
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
    domainId: isUuid(value.domainId) && kind !== 'habit' ? value.domainId : null,
    // Older backups have neither: keep what the app did before.
    keepStreak: typeof value.keepStreak === 'boolean' ? value.keepStreak : kind !== 'project',
    routineDays: normalizeRoutine(value.routineDays),
    addedDays: normalizeDayList(value.addedDays),
    skippedDays: normalizeDayList(value.skippedDays),
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

function parseBadHabit(value: unknown): BadHabit {
  if (!isRecord(value) || !isUuid(value.id) || typeof value.name !== 'string') {
    throw new BackupError('This backup contains a bad habit that cannot be read.');
  }
  return {
    id: value.id,
    name: value.name,
    icon: typeof value.icon === 'string' && value.icon !== '' ? value.icon : '🚫',
    color: isSkillColor(value.color) ? value.color : SKILL_COLORS[0],
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  };
}

function parseCheckIn(value: unknown): CheckIn {
  if (
    !isRecord(value) ||
    !isUuid(value.habitId) ||
    !isDayKey(value.day) ||
    (value.status !== 'clean' && value.status !== 'slipped')
  ) {
    throw new BackupError('This backup contains a bad habit check-in that cannot be read.');
  }
  return {
    // Rebuilt rather than trusted, so it always matches the habit and day.
    id: checkInId(value.habitId, value.day),
    habitId: value.habitId,
    day: value.day,
    status: value.status,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  };
}

function parseDomain(value: unknown): Domain {
  if (!isRecord(value) || !isUuid(value.id) || typeof value.name !== 'string') {
    throw new BackupError('This backup contains a domain that cannot be read.');
  }
  return {
    id: value.id,
    name: value.name,
    icon: typeof value.icon === 'string' && value.icon !== '' ? value.icon : '🧭',
    color: isSkillColor(value.color) ? value.color : SKILL_COLORS[0],
    routineDays: normalizeRoutine(value.routineDays),
    addedDays: normalizeDayList(value.addedDays),
    skippedDays: normalizeDayList(value.skippedDays),
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
    status: LIBRARY_STATUSES.find((status) => status === value.status) ?? 'active',
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

function parseTodo(value: unknown): Todo {
  const title =
    isRecord(value) && typeof value.title === 'string' ? cleanTodoTitle(value.title) : null;
  if (!isRecord(value) || !isUuid(value.id) || title === null) {
    throw new BackupError('This backup contains a to-do that cannot be read.');
  }
  const done = value.done === true;
  const createdAt = typeof value.createdAt === 'number' ? value.createdAt : Date.now();
  const domainId = isUuid(value.domainId) ? value.domainId : null;
  return {
    id: value.id,
    title,
    done,
    createdAt,
    doneAt: done && typeof value.doneAt === 'number' ? value.doneAt : null,
    // Older backups have neither: General, on the day it was written.
    domainId,
    skillId: domainId === null && isUuid(value.skillId) ? value.skillId : null,
    day: isDayKey(value.day) ? value.day : toDayKey(new Date(createdAt)),
    deadline: isDayKey(value.deadline) ? value.deadline : null,
  };
}

function parseMoneySection(value: unknown): MoneySection {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    typeof value.name !== 'string' ||
    value.name.trim() === ''
  ) {
    throw new BackupError('This backup contains a money section that cannot be read.');
  }
  return {
    id: value.id,
    name: value.name.trim().slice(0, 60),
    icon: typeof value.icon === 'string' && value.icon !== '' ? value.icon.slice(0, 16) : '💼',
    color: isSkillColor(value.color) ? value.color : SKILL_COLORS[0],
    carryOver: value.carryOver === true,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  };
}

const MONEY_KINDS: readonly unknown[] = ['spend', 'add', 'move'];

function parseMoneyEntry(value: unknown, sections: ReadonlySet<string>): MoneyEntry {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    typeof value.sectionId !== 'string' ||
    !sections.has(value.sectionId) ||
    !MONEY_KINDS.includes(value.kind) ||
    !isDayKey(value.day) ||
    typeof value.amount !== 'number' ||
    !Number.isInteger(value.amount) ||
    value.amount <= 0 ||
    value.amount > MONEY_AMOUNT_MAX
  ) {
    throw new BackupError('This backup contains a money entry that cannot be read.');
  }
  const kind = value.kind as MoneyEntry['kind'];
  const toSectionId =
    kind === 'move' && typeof value.toSectionId === 'string' && sections.has(value.toSectionId)
      ? value.toSectionId
      : null;
  if (kind === 'move' && (toSectionId === null || toSectionId === value.sectionId)) {
    throw new BackupError('This backup contains a money move that cannot be read.');
  }
  return {
    id: value.id,
    sectionId: value.sectionId,
    kind,
    toSectionId,
    day: value.day,
    amount: value.amount,
    note: typeof value.note === 'string' ? cleanNote(value.note) : '',
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  };
}

const isAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MONEY_AMOUNT_MAX;

function parseDebt(value: unknown): Debt {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    (value.direction !== 'borrowed' && value.direction !== 'lent') ||
    typeof value.person !== 'string' ||
    value.person.trim() === '' ||
    !isAmount(value.amount) ||
    !isDayKey(value.day)
  ) {
    throw new BackupError('This backup contains a debt that cannot be read.');
  }
  return {
    id: value.id,
    direction: value.direction,
    person: value.person.trim().slice(0, DEBT_PERSON_MAX),
    amount: value.amount,
    day: value.day,
    dueDay: isDayKey(value.dueDay) ? value.dueDay : null,
    sectionId: isUuid(value.sectionId) ? value.sectionId : null,
    inBudget: value.inBudget === true,
    note: typeof value.note === 'string' ? cleanNote(value.note) : '',
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  };
}

function parseDebtPayment(value: unknown, debts: ReadonlySet<string>): DebtPayment {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    typeof value.debtId !== 'string' ||
    !debts.has(value.debtId) ||
    !isAmount(value.amount) ||
    !isDayKey(value.day)
  ) {
    throw new BackupError('This backup contains a debt payment that cannot be read.');
  }
  return {
    id: value.id,
    debtId: value.debtId,
    day: value.day,
    amount: value.amount,
    sectionId: isUuid(value.sectionId) ? value.sectionId : null,
    note: typeof value.note === 'string' ? cleanNote(value.note) : '',
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  };
}
