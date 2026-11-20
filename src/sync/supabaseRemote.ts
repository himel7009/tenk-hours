import { DEBT_PERSON_MAX, type Debt, type DebtDirection, type DebtPayment } from '../domain/debts';
import {
  cleanNote,
  type MoneyEntry,
  type MoneyEntryKind,
  type MoneySection,
} from '../domain/money';
import { cleanTodoTitle, type Todo } from '../domain/todos';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BadHabit, CheckIn, CheckInStatus } from '../domain/badHabits';
import type { Domain } from '../domain/domains';
import {
  isWebUrl,
  LIBRARY_LIMITS,
  type LibraryItem,
  type LibraryKind,
  type LibraryStatus,
  type LibraryUnit,
} from '../domain/library';
import { normalizeRoutine } from '../domain/routine';
import type { Session, Skill, SkillColor, TrackerKind } from '../domain/types';
import type { PushBatch, RemoteChanges, RemoteRow, RemoteStore, SyncCursors } from './types';

const UPSERT_CHUNK = 500;
const DELETE_CHUNK = 100;
/** PostgREST returns at most 1000 rows per request by default. */
const PAGE_SIZE = 1000;
/**
 * A row's updated_at is its transaction's start time, so a write that began
 * before a pull can commit just after it with a timestamp at or below the
 * cursor. To catch those, the first pull from any given cursor also re-reads
 * this much before it. Re-read rows are applied again, which is harmless.
 */
const CURSOR_OVERLAP_MS = 5000;

interface SkillRow {
  id: string;
  kind: TrackerKind;
  name: string;
  icon: string;
  color: SkillColor;
  target_hours: number;
  daily_goal_minutes: number;
  domain_id: string | null;
  keep_streak: boolean;
  routine_days: number[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface SessionRow {
  id: string;
  skill_id: string;
  day: string;
  minutes: number;
  note: string;
  source: Session['source'];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface LibraryRow {
  id: string;
  kind: LibraryKind;
  title: string;
  author: string;
  url: string;
  unit: LibraryUnit;
  total_units: number | null;
  done_units: number;
  position: string;
  notes: string;
  status: LibraryStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface DomainRow {
  id: string;
  name: string;
  icon: string;
  color: SkillColor;
  routine_days: number[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface BadHabitRow {
  id: string;
  name: string;
  icon: string;
  color: SkillColor;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface CheckInRow {
  id: string;
  habit_id: string;
  day: string;
  status: CheckInStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface TodoRow {
  id: string;
  title: string;
  done: boolean;
  done_at: string | null;
  domain_id: string | null;
  skill_id: string | null;
  day: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

type Table =
  | 'skills'
  | 'sessions'
  | 'library_items'
  | 'domains'
  | 'bad_habits'
  | 'bad_habit_checkins'
  | 'todos'
  | 'money_sections'
  | 'money_entries'
  | 'money_debts'
  | 'money_debt_payments';

const TODO_COLUMNS =
  'id,title,done,done_at,domain_id,skill_id,day,created_at,updated_at,deleted_at';

const BAD_HABIT_COLUMNS = 'id,name,icon,color,created_at,updated_at,deleted_at';
const CHECK_IN_COLUMNS = 'id,habit_id,day,status,created_at,updated_at,deleted_at';

const SKILL_COLUMNS =
  'id,kind,name,icon,color,target_hours,daily_goal_minutes,domain_id,keep_streak,routine_days,created_at,updated_at,deleted_at';
const DOMAIN_COLUMNS = 'id,name,icon,color,routine_days,created_at,updated_at,deleted_at';
const SESSION_COLUMNS = 'id,skill_id,day,minutes,note,source,created_at,updated_at,deleted_at';

const LIBRARY_COLUMNS =
  'id,kind,title,author,url,unit,total_units,done_units,position,notes,status,created_at,updated_at,deleted_at';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

// Rows are trimmed to the database's limits on the way out. Data restored
// from an old backup can exceed them, and one rejected row would otherwise
// block every later sync.
function toSkillRow(skill: Skill) {
  return {
    id: skill.id,
    kind: skill.kind,
    name: skill.name.trim().slice(0, 40) || 'Untitled',
    icon: skill.icon.slice(0, 16) || '🎯',
    color: skill.color,
    target_hours: clamp(skill.targetHours, 1, 100_000),
    daily_goal_minutes: clamp(skill.dailyGoalMinutes, 1, 1440),
    domain_id: skill.domainId,
    keep_streak: skill.keepStreak,
    routine_days: normalizeRoutine(skill.routineDays),
    created_at: new Date(skill.createdAt).toISOString(),
    deleted_at: null,
  };
}

function toSessionRow(session: Session) {
  return {
    id: session.id,
    skill_id: session.skillId,
    day: session.day,
    minutes: clamp(session.minutes, 1, 1440),
    note: session.note.slice(0, 140),
    source: session.source,
    created_at: new Date(session.createdAt).toISOString(),
    deleted_at: null,
  };
}

function toDomainRow(domain: Domain) {
  return {
    id: domain.id,
    name: domain.name.trim().slice(0, 40) || 'Untitled',
    icon: domain.icon.slice(0, 16) || '🧭',
    color: domain.color,
    routine_days: normalizeRoutine(domain.routineDays),
    created_at: new Date(domain.createdAt).toISOString(),
    deleted_at: null,
  };
}

function fromDomainRow(row: DomainRow): RemoteRow<Domain> {
  return {
    deleted: row.deleted_at !== null,
    row: {
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      routineDays: normalizeRoutine(row.routine_days),
      createdAt: Date.parse(row.created_at),
    },
  };
}

function toBadHabitRow(habit: BadHabit) {
  return {
    id: habit.id,
    name: habit.name.trim().slice(0, 40) || 'Untitled',
    icon: habit.icon.slice(0, 16) || '🚫',
    color: habit.color,
    created_at: new Date(habit.createdAt).toISOString(),
    deleted_at: null,
  };
}

function fromBadHabitRow(row: BadHabitRow): RemoteRow<BadHabit> {
  return {
    deleted: row.deleted_at !== null,
    row: {
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      createdAt: Date.parse(row.created_at),
    },
  };
}

function toCheckInRow(checkIn: CheckIn) {
  return {
    id: checkIn.id,
    habit_id: checkIn.habitId,
    day: checkIn.day,
    status: checkIn.status,
    created_at: new Date(checkIn.createdAt).toISOString(),
    deleted_at: null,
  };
}

function fromCheckInRow(row: CheckInRow): RemoteRow<CheckIn> {
  return {
    deleted: row.deleted_at !== null,
    row: {
      id: row.id,
      habitId: row.habit_id,
      day: row.day,
      status: row.status,
      createdAt: Date.parse(row.created_at),
    },
  };
}

interface MoneySectionRow {
  id: string;
  name: string;
  icon: string;
  color: SkillColor;
  carry_over: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface MoneyEntryRow {
  id: string;
  section_id: string;
  kind: MoneyEntryKind;
  to_section_id: string | null;
  day: string;
  amount: number;
  note: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const MONEY_SECTION_COLUMNS = 'id,name,icon,color,carry_over,created_at,updated_at,deleted_at';
const MONEY_ENTRY_COLUMNS =
  'id,section_id,kind,to_section_id,day,amount,note,created_at,updated_at,deleted_at';

function toMoneySectionRow(section: MoneySection) {
  return {
    id: section.id,
    name: section.name,
    icon: section.icon,
    color: section.color,
    carry_over: section.carryOver,
    created_at: new Date(section.createdAt).toISOString(),
    deleted_at: null,
  };
}

function fromMoneySectionRow(row: MoneySectionRow): RemoteRow<MoneySection> {
  return {
    deleted: row.deleted_at !== null,
    row: {
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      carryOver: row.carry_over,
      createdAt: Date.parse(row.created_at),
    },
  };
}

function toMoneyEntryRow(entry: MoneyEntry) {
  return {
    id: entry.id,
    section_id: entry.sectionId,
    kind: entry.kind,
    to_section_id: entry.kind === 'move' ? entry.toSectionId : null,
    day: entry.day,
    amount: entry.amount,
    note: cleanNote(entry.note),
    created_at: new Date(entry.createdAt).toISOString(),
    deleted_at: null,
  };
}

function fromMoneyEntryRow(row: MoneyEntryRow): RemoteRow<MoneyEntry> {
  return {
    deleted: row.deleted_at !== null,
    row: {
      id: row.id,
      sectionId: row.section_id,
      kind: row.kind,
      toSectionId: row.to_section_id,
      day: row.day,
      // bigint can arrive as a string.
      amount: Number(row.amount),
      note: row.note,
      createdAt: Date.parse(row.created_at),
    },
  };
}

interface DebtRow {
  id: string;
  direction: DebtDirection;
  person: string;
  amount: number;
  day: string;
  due_day: string | null;
  section_id: string | null;
  in_budget: boolean;
  note: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface DebtPaymentRow {
  id: string;
  debt_id: string;
  day: string;
  amount: number;
  section_id: string | null;
  note: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const DEBT_COLUMNS =
  'id,direction,person,amount,day,due_day,section_id,in_budget,note,created_at,updated_at,deleted_at';
const DEBT_PAYMENT_COLUMNS =
  'id,debt_id,day,amount,section_id,note,created_at,updated_at,deleted_at';

function toDebtRow(debt: Debt) {
  return {
    id: debt.id,
    direction: debt.direction,
    person: debt.person.slice(0, DEBT_PERSON_MAX),
    amount: debt.amount,
    day: debt.day,
    due_day: debt.dueDay,
    section_id: debt.sectionId,
    in_budget: debt.inBudget,
    note: cleanNote(debt.note),
    created_at: new Date(debt.createdAt).toISOString(),
    deleted_at: null,
  };
}

function fromDebtRow(row: DebtRow): RemoteRow<Debt> {
  return {
    deleted: row.deleted_at !== null,
    row: {
      id: row.id,
      direction: row.direction,
      person: row.person,
      amount: Number(row.amount),
      day: row.day,
      dueDay: row.due_day,
      sectionId: row.section_id,
      inBudget: row.in_budget === true,
      note: row.note,
      createdAt: Date.parse(row.created_at),
    },
  };
}

function toDebtPaymentRow(payment: DebtPayment) {
  return {
    id: payment.id,
    debt_id: payment.debtId,
    day: payment.day,
    amount: payment.amount,
    section_id: payment.sectionId,
    note: cleanNote(payment.note),
    created_at: new Date(payment.createdAt).toISOString(),
    deleted_at: null,
  };
}

function fromDebtPaymentRow(row: DebtPaymentRow): RemoteRow<DebtPayment> {
  return {
    deleted: row.deleted_at !== null,
    row: {
      id: row.id,
      debtId: row.debt_id,
      day: row.day,
      amount: Number(row.amount),
      sectionId: row.section_id,
      note: row.note,
      createdAt: Date.parse(row.created_at),
    },
  };
}

function toTodoRow(todo: Todo) {
  return {
    id: todo.id,
    title: cleanTodoTitle(todo.title) ?? 'Untitled',
    done: todo.done,
    done_at: todo.done && todo.doneAt !== null ? new Date(todo.doneAt).toISOString() : null,
    domain_id: todo.domainId,
    skill_id: todo.domainId === null ? todo.skillId : null,
    day: todo.day,
    created_at: new Date(todo.createdAt).toISOString(),
    deleted_at: null,
  };
}

function fromTodoRow(row: TodoRow): RemoteRow<Todo> {
  return {
    deleted: row.deleted_at !== null,
    row: {
      id: row.id,
      title: row.title,
      done: row.done,
      doneAt: row.done_at === null ? null : Date.parse(row.done_at),
      domainId: row.domain_id,
      skillId: row.domain_id === null ? row.skill_id : null,
      day: row.day,
      createdAt: Date.parse(row.created_at),
    },
  };
}

function toLibraryRow(item: LibraryItem) {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title.trim().slice(0, LIBRARY_LIMITS.title) || 'Untitled',
    author: item.author.slice(0, LIBRARY_LIMITS.author),
    url: isWebUrl(item.url) && item.url.length <= LIBRARY_LIMITS.url ? item.url : '',
    unit: item.unit,
    total_units: item.totalUnits === null ? null : clamp(item.totalUnits, 1, LIBRARY_LIMITS.units),
    done_units: clamp(item.doneUnits, 0, LIBRARY_LIMITS.units),
    position: item.position.slice(0, LIBRARY_LIMITS.position),
    notes: item.notes.slice(0, LIBRARY_LIMITS.notes),
    status: item.status,
    created_at: new Date(item.createdAt).toISOString(),
    deleted_at: null,
  };
}

function fromLibraryRow(row: LibraryRow): RemoteRow<LibraryItem> {
  return {
    deleted: row.deleted_at !== null,
    row: {
      id: row.id,
      kind: row.kind,
      title: row.title,
      author: row.author,
      // Checked again on the way in: the app renders this as a link.
      url: isWebUrl(row.url) ? row.url : '',
      unit: row.unit,
      totalUnits: row.total_units,
      doneUnits: row.done_units,
      position: row.position,
      notes: row.notes,
      status: row.status,
      createdAt: Date.parse(row.created_at),
    },
  };
}

function fromSkillRow(row: SkillRow): RemoteRow<Skill> {
  return {
    deleted: row.deleted_at !== null,
    row: {
      id: row.id,
      kind: row.kind,
      name: row.name,
      icon: row.icon,
      color: row.color,
      targetHours: row.target_hours,
      dailyGoalMinutes: row.daily_goal_minutes,
      domainId: row.domain_id,
      keepStreak: row.keep_streak,
      routineDays: normalizeRoutine(row.routine_days),
      createdAt: Date.parse(row.created_at),
    },
  };
}

function fromSessionRow(row: SessionRow): RemoteRow<Session> {
  return {
    deleted: row.deleted_at !== null,
    row: {
      id: row.id,
      skillId: row.skill_id,
      day: row.day,
      minutes: row.minutes,
      note: row.note,
      source: row.source,
      createdAt: Date.parse(row.created_at),
    },
  };
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}

/** The newest updated_at among the rows, or the cursor if none is newer. */
function advance(cursor: string | null, rows: { updated_at: string }[]): string | null {
  return rows.reduce<string | null>(
    (latest, row) =>
      latest === null || Date.parse(row.updated_at) > Date.parse(latest) ? row.updated_at : latest,
    cursor,
  );
}

export function createSupabaseRemote(client: SupabaseClient): RemoteStore {
  /** Cursors an overlapping pull has already completed from. */
  const settled = new Set<string>();

  async function upsert(table: Table, rows: object[]) {
    for (const chunk of chunks(rows, UPSERT_CHUNK)) {
      const { error } = await client.from(table).upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
    }
  }

  async function softDelete(table: Table, ids: string[]) {
    const deleted_at = new Date().toISOString();
    for (const chunk of chunks(ids, DELETE_CHUNK)) {
      const { error } = await client.from(table).update({ deleted_at }).in('id', chunk);
      if (error) throw error;
    }
  }

  async function fetchChanged<Row>(
    table: Table,
    columns: string,
    cursor: string | null,
  ): Promise<Row[]> {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = client.from(table).select(columns);
      if (cursor === null) {
        // First sync on this device: rows deleted elsewhere are of no interest.
        query = query.is('deleted_at', null);
      } else if (settled.has(cursor)) {
        query = query.gt('updated_at', cursor);
      } else {
        const since = new Date(Date.parse(cursor) - CURSOR_OVERLAP_MS).toISOString();
        query = query.gt('updated_at', since);
      }
      const { data, error } = await query
        .order('updated_at')
        .order('id')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...(data as Row[]));
      if (data.length < PAGE_SIZE) return rows;
    }
  }

  return {
    async push(batch: PushBatch) {
      // Order matters: skills reference domains, and sessions reference skills.
      await upsert('domains', batch.domainUpserts.map(toDomainRow));
      await upsert('skills', batch.skillUpserts.map(toSkillRow));
      await upsert('sessions', batch.sessionUpserts.map(toSessionRow));
      await softDelete('sessions', batch.sessionDeletes);
      await softDelete('skills', batch.skillDeletes);
      await upsert('library_items', batch.libraryUpserts.map(toLibraryRow));
      await softDelete('library_items', batch.libraryDeletes);
      // After the skill upserts above have moved every skill out of them.
      await softDelete('domains', batch.domainDeletes);
      // Check-ins reference bad habits.
      await upsert('bad_habits', batch.badHabitUpserts.map(toBadHabitRow));
      await upsert('bad_habit_checkins', batch.checkInUpserts.map(toCheckInRow));
      await softDelete('bad_habit_checkins', batch.checkInDeletes);
      await softDelete('bad_habits', batch.badHabitDeletes);
      await upsert('todos', batch.todoUpserts.map(toTodoRow));
      await softDelete('todos', batch.todoDeletes);
      // Sections before the entries that point at them, and entries deleted
      // before their sections.
      await upsert('money_sections', batch.moneySectionUpserts.map(toMoneySectionRow));
      await upsert('money_entries', batch.moneyEntryUpserts.map(toMoneyEntryRow));
      await softDelete('money_entries', batch.moneyEntryDeletes);
      await softDelete('money_sections', batch.moneySectionDeletes);
      // A debt before its payments; payments deleted before their debt.
      await upsert('money_debts', batch.debtUpserts.map(toDebtRow));
      await upsert('money_debt_payments', batch.debtPaymentUpserts.map(toDebtPaymentRow));
      await softDelete('money_debt_payments', batch.debtPaymentDeletes);
      await softDelete('money_debts', batch.debtDeletes);
    },

    async pull({
      cursor,
      libraryCursor,
      domainCursor,
      badHabitCursor,
      todoCursor,
      moneyCursor,
    }: SyncCursors): Promise<RemoteChanges> {
      const moneySectionRows = await fetchChanged<MoneySectionRow>(
        'money_sections',
        MONEY_SECTION_COLUMNS,
        moneyCursor,
      );
      const moneyEntryRows = await fetchChanged<MoneyEntryRow>(
        'money_entries',
        MONEY_ENTRY_COLUMNS,
        moneyCursor,
      );
      const debtRows = await fetchChanged<DebtRow>('money_debts', DEBT_COLUMNS, moneyCursor);
      const debtPaymentRows = await fetchChanged<DebtPaymentRow>(
        'money_debt_payments',
        DEBT_PAYMENT_COLUMNS,
        moneyCursor,
      );
      const todoRows = await fetchChanged<TodoRow>('todos', TODO_COLUMNS, todoCursor);
      const badHabitRows = await fetchChanged<BadHabitRow>(
        'bad_habits',
        BAD_HABIT_COLUMNS,
        badHabitCursor,
      );
      const checkInRows = await fetchChanged<CheckInRow>(
        'bad_habit_checkins',
        CHECK_IN_COLUMNS,
        badHabitCursor,
      );
      const domainRows = await fetchChanged<DomainRow>('domains', DOMAIN_COLUMNS, domainCursor);
      const skillRows = await fetchChanged<SkillRow>('skills', SKILL_COLUMNS, cursor);
      const sessionRows = await fetchChanged<SessionRow>('sessions', SESSION_COLUMNS, cursor);
      const libraryRows = await fetchChanged<LibraryRow>(
        'library_items',
        LIBRARY_COLUMNS,
        libraryCursor,
      );

      const next: SyncCursors = {
        cursor: advance(cursor, [...skillRows, ...sessionRows]),
        libraryCursor: advance(libraryCursor, libraryRows),
        domainCursor: advance(domainCursor, domainRows),
        badHabitCursor: advance(badHabitCursor, [...badHabitRows, ...checkInRows]),
        todoCursor: advance(todoCursor, todoRows),
        moneyCursor: advance(moneyCursor, [
          ...moneySectionRows,
          ...moneyEntryRows,
          ...debtRows,
          ...debtPaymentRows,
        ]),
      };
      // Nothing newer turned up, so later pulls from here can skip the overlap.
      if (next.cursor !== null && next.cursor === cursor) settled.add(cursor);
      if (next.libraryCursor !== null && next.libraryCursor === libraryCursor) {
        settled.add(libraryCursor);
      }
      if (next.domainCursor !== null && next.domainCursor === domainCursor) {
        settled.add(domainCursor);
      }
      if (next.badHabitCursor !== null && next.badHabitCursor === badHabitCursor) {
        settled.add(badHabitCursor);
      }
      if (next.todoCursor !== null && next.todoCursor === todoCursor) settled.add(todoCursor);
      if (next.moneyCursor !== null && next.moneyCursor === moneyCursor) settled.add(moneyCursor);

      return {
        skills: skillRows.map(fromSkillRow),
        sessions: sessionRows.map(fromSessionRow),
        library: libraryRows.map(fromLibraryRow),
        domains: domainRows.map(fromDomainRow),
        badHabits: badHabitRows.map(fromBadHabitRow),
        checkIns: checkInRows.map(fromCheckInRow),
        todos: todoRows.map(fromTodoRow),
        moneySections: moneySectionRows.map(fromMoneySectionRow),
        moneyEntries: moneyEntryRows.map(fromMoneyEntryRow),
        debts: debtRows.map(fromDebtRow),
        debtPayments: debtPaymentRows.map(fromDebtPaymentRow),
        cursors: next,
      };
    },
  };
}
