import type { MoneyEntry, MoneySection } from '../domain/money';
import type { Todo } from '../domain/todos';
import type { BadHabit, CheckIn } from '../domain/badHabits';
import type { Domain } from '../domain/domains';
import type { LibraryItem } from '../domain/library';
import type { Session, Skill } from '../domain/types';
import type {
  PendingChange,
  PushedRevisions,
  PushBatch,
  RemoteChanges,
  RemoteStore,
  SyncState,
} from './types';

/** The parts of the tracker store the engine needs. */
export interface SyncableStore {
  getState(): {
    skills: Skill[];
    sessions: Session[];
    library: LibraryItem[];
    domains: Domain[];
    badHabits: BadHabit[];
    checkIns: CheckIn[];
    todos: Todo[];
    moneySections: MoneySection[];
    moneyEntries: MoneyEntry[];
    sync: SyncState;
    acknowledgePush(pushed: PushedRevisions): void;
    applyRemoteChanges(changes: RemoteChanges): void;
  };
}

interface PlannedPush {
  batch: PushBatch;
  revisions: PushedRevisions;
}

/** Everything planPush reads from the store. */
export interface PushSource {
  skills: Skill[];
  sessions: Session[];
  library: LibraryItem[];
  domains: Domain[];
  badHabits: BadHabit[];
  checkIns: CheckIn[];
  todos: Todo[];
  moneySections: MoneySection[];
  moneyEntries: MoneyEntry[];
  sync: SyncState;
}

/**
 * Collects one table's pending entries: deletes go by id, upserts by row,
 * and an entry whose row is gone or unsendable is dropped (but still
 * acknowledged, so it does not linger).
 */
function collect<T extends { id: string }>(
  pending: SyncState[keyof SyncState],
  rows: readonly T[],
  revisions: Record<string, number>,
  canSend: (row: T) => boolean = () => true,
): { upserts: T[]; deletes: string[] } {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const upserts: T[] = [];
  const deletes: string[] = [];
  for (const [id, { op, rev }] of Object.entries(pending as Record<string, PendingChange>)) {
    revisions[id] = rev;
    const row = byId.get(id);
    if (op === 'delete') deletes.push(id);
    else if (row && canSend(row)) upserts.push(row);
  }
  return { upserts, deletes };
}

/** Turns the pending entries into the rows and ids to send. */
export function planPush(source: PushSource): PlannedPush {
  const { sync } = source;
  const revisions: PushedRevisions = {
    skills: {},
    sessions: {},
    library: {},
    domains: {},
    badHabits: {},
    checkIns: {},
    todos: {},
    moneySections: {},
    moneyEntries: {},
  };
  const skillIds = new Set(source.skills.map((skill) => skill.id));
  const habitIds = new Set(source.badHabits.map((habit) => habit.id));

  const skills = collect(sync.pendingSkills, source.skills, revisions.skills);
  // A session or check-in whose parent is gone locally has nothing to attach to remotely.
  const sessions = collect(sync.pendingSessions, source.sessions, revisions.sessions, (s) =>
    skillIds.has(s.skillId),
  );
  const library = collect(sync.pendingLibrary, source.library, revisions.library);
  const domains = collect(sync.pendingDomains, source.domains, revisions.domains);
  const badHabits = collect(sync.pendingBadHabits, source.badHabits, revisions.badHabits);
  const checkIns = collect(sync.pendingCheckIns, source.checkIns, revisions.checkIns, (c) =>
    habitIds.has(c.habitId),
  );

  const todos = collect(sync.pendingTodos, source.todos, revisions.todos);
  const moneySections = collect(
    sync.pendingMoneySections,
    source.moneySections,
    revisions.moneySections,
  );
  const moneyEntries = collect(
    sync.pendingMoneyEntries,
    source.moneyEntries,
    revisions.moneyEntries,
  );

  return {
    batch: {
      skillUpserts: skills.upserts,
      skillDeletes: skills.deletes,
      sessionUpserts: sessions.upserts,
      sessionDeletes: sessions.deletes,
      libraryUpserts: library.upserts,
      libraryDeletes: library.deletes,
      domainUpserts: domains.upserts,
      domainDeletes: domains.deletes,
      badHabitUpserts: badHabits.upserts,
      badHabitDeletes: badHabits.deletes,
      checkInUpserts: checkIns.upserts,
      checkInDeletes: checkIns.deletes,
      todoUpserts: todos.upserts,
      todoDeletes: todos.deletes,
      moneySectionUpserts: moneySections.upserts,
      moneySectionDeletes: moneySections.deletes,
      moneyEntryUpserts: moneyEntries.upserts,
      moneyEntryDeletes: moneyEntries.deletes,
    },
    revisions,
  };
}

const isEmpty = (batch: PushBatch) => Object.values(batch).every((list) => list.length === 0);

/**
 * One sync round: send local changes, then fetch what changed remotely.
 *
 * Conflicts resolve as last push wins per row. Pushing first means a row
 * edited on two devices ends up as whichever device synced later, and the
 * following pull brings every device to that same state.
 */
export async function syncOnce(remote: RemoteStore, store: SyncableStore): Promise<void> {
  const { batch, revisions } = planPush(store.getState());

  if (!isEmpty(batch)) await remote.push(batch);
  store.getState().acknowledgePush(revisions);

  const { cursor, libraryCursor, domainCursor, badHabitCursor, todoCursor, moneyCursor } =
    store.getState().sync;
  const changes = await remote.pull({
    cursor,
    libraryCursor,
    domainCursor,
    badHabitCursor,
    todoCursor,
    moneyCursor,
  });
  store.getState().applyRemoteChanges(changes);
}
