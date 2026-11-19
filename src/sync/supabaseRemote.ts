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
  | 'todos';

const TODO_COLUMNS = 'id,title,done,done_at,created_at,updated_at,deleted_at';

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

function toTodoRow(todo: Todo) {
  return {
    id: todo.id,
    title: cleanTodoTitle(todo.title) ?? 'Untitled',
    done: todo.done,
    done_at: todo.done && todo.doneAt !== null ? new Date(todo.doneAt).toISOString() : null,
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
    },

    async pull({
      cursor,
      libraryCursor,
      domainCursor,
      badHabitCursor,
      todoCursor,
    }: SyncCursors): Promise<RemoteChanges> {
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

      return {
        skills: skillRows.map(fromSkillRow),
        sessions: sessionRows.map(fromSessionRow),
        library: libraryRows.map(fromLibraryRow),
        domains: domainRows.map(fromDomainRow),
        badHabits: badHabitRows.map(fromBadHabitRow),
        checkIns: checkInRows.map(fromCheckInRow),
        todos: todoRows.map(fromTodoRow),
        cursors: next,
      };
    },
  };
}
