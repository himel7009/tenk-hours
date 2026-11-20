import type { MoneyEntry, MoneyEntryId, MoneySection, MoneySectionId } from '../domain/money';
import type { Todo, TodoId } from '../domain/todos';
import type { BadHabit, BadHabitId, CheckIn } from '../domain/badHabits';
import type { Domain, DomainId } from '../domain/domains';
import type { LibraryItem, LibraryItemId } from '../domain/library';
import type { Session, SessionId, Skill, SkillId } from '../domain/types';

export type PendingOp = 'upsert' | 'delete';

/** A local change that has not reached the server yet. */
export interface PendingChange {
  op: PendingOp;
  /** Value of SyncState.rev when the change was made; see acknowledgePush. */
  rev: number;
}

export interface SyncState {
  /** The account the local data belongs to. Null while used as a guest. */
  ownerId: string | null;
  /** Server timestamp of the newest skill or session pulled so far. */
  cursor: string | null;
  /**
   * The same for library items. Kept apart because the library arrived in a
   * later release: a device upgrading must pull the whole library once, even
   * though its skills and sessions are already up to date.
   */
  libraryCursor: string | null;
  /** The same for domains, which arrived later still. */
  domainCursor: string | null;
  /** The same for bad habits and their check-ins, which share one. */
  badHabitCursor: string | null;
  /** The same for to-dos. */
  todoCursor: string | null;
  /** The same for money sections and entries, which share one. */
  moneyCursor: string | null;
  /** Counter bumped on every local change while an account owns the data. */
  rev: number;
  pendingSkills: Record<SkillId, PendingChange>;
  pendingSessions: Record<SessionId, PendingChange>;
  pendingLibrary: Record<LibraryItemId, PendingChange>;
  pendingDomains: Record<DomainId, PendingChange>;
  pendingBadHabits: Record<BadHabitId, PendingChange>;
  pendingCheckIns: Record<string, PendingChange>;
  pendingTodos: Record<TodoId, PendingChange>;
  pendingMoneySections: Record<MoneySectionId, PendingChange>;
  pendingMoneyEntries: Record<MoneyEntryId, PendingChange>;
}

export const initialSyncState: SyncState = {
  ownerId: null,
  cursor: null,
  libraryCursor: null,
  domainCursor: null,
  badHabitCursor: null,
  todoCursor: null,
  moneyCursor: null,
  rev: 0,
  pendingSkills: {},
  pendingSessions: {},
  pendingLibrary: {},
  pendingDomains: {},
  pendingBadHabits: {},
  pendingCheckIns: {},
  pendingTodos: {},
  pendingMoneySections: {},
  pendingMoneyEntries: {},
};

export interface RemoteRow<T> {
  row: T;
  deleted: boolean;
}

/** Rows changed on the server since a cursor. */
export interface RemoteChanges {
  skills: RemoteRow<Skill>[];
  sessions: RemoteRow<Session>[];
  library: RemoteRow<LibraryItem>[];
  domains: RemoteRow<Domain>[];
  badHabits: RemoteRow<BadHabit>[];
  checkIns: RemoteRow<CheckIn>[];
  todos: RemoteRow<Todo>[];
  moneySections: RemoteRow<MoneySection>[];
  moneyEntries: RemoteRow<MoneyEntry>[];
  /** Cursors to store for the next pull. */
  cursors: SyncCursors;
}

export interface SyncCursors {
  cursor: string | null;
  libraryCursor: string | null;
  domainCursor: string | null;
  badHabitCursor: string | null;
  todoCursor: string | null;
  moneyCursor: string | null;
}

export interface PushBatch {
  skillUpserts: Skill[];
  sessionUpserts: Session[];
  skillDeletes: SkillId[];
  sessionDeletes: SessionId[];
  libraryUpserts: LibraryItem[];
  libraryDeletes: LibraryItemId[];
  domainUpserts: Domain[];
  domainDeletes: DomainId[];
  badHabitUpserts: BadHabit[];
  badHabitDeletes: BadHabitId[];
  checkInUpserts: CheckIn[];
  checkInDeletes: string[];
  todoUpserts: Todo[];
  todoDeletes: TodoId[];
  moneySectionUpserts: MoneySection[];
  moneySectionDeletes: MoneySectionId[];
  moneyEntryUpserts: MoneyEntry[];
  moneyEntryDeletes: MoneyEntryId[];
}

/** The revisions a push covered, so only unchanged entries are cleared. */
export interface PushedRevisions {
  skills: Record<SkillId, number>;
  sessions: Record<SessionId, number>;
  library: Record<LibraryItemId, number>;
  domains: Record<DomainId, number>;
  badHabits: Record<BadHabitId, number>;
  checkIns: Record<string, number>;
  todos: Record<TodoId, number>;
  moneySections: Record<MoneySectionId, number>;
  moneyEntries: Record<MoneyEntryId, number>;
}

/**
 * The server as the sync engine sees it. The Supabase implementation lives in
 * supabaseRemote.ts; tests use an in-memory one.
 */
export interface RemoteStore {
  push(batch: PushBatch): Promise<void>;
  pull(cursors: SyncCursors): Promise<RemoteChanges>;
}
