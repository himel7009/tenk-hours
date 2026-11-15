import type { LibraryItem } from '../domain/library';
import type { Session, Skill } from '../domain/types';
import type { PushBatch, PushedRevisions, RemoteChanges, RemoteStore, SyncState } from './types';

/** The parts of the tracker store the engine needs. */
export interface SyncableStore {
  getState(): {
    skills: Skill[];
    sessions: Session[];
    library: LibraryItem[];
    sync: SyncState;
    acknowledgePush(pushed: PushedRevisions): void;
    applyRemoteChanges(changes: RemoteChanges): void;
  };
}

interface PlannedPush {
  batch: PushBatch;
  revisions: PushedRevisions;
}

/** Turns the pending entries into the rows and ids to send. */
export function planPush(
  skills: Skill[],
  sessions: Session[],
  library: LibraryItem[],
  sync: SyncState,
): PlannedPush {
  const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const libraryById = new Map(library.map((item) => [item.id, item]));
  const batch: PushBatch = {
    skillUpserts: [],
    sessionUpserts: [],
    skillDeletes: [],
    sessionDeletes: [],
    libraryUpserts: [],
    libraryDeletes: [],
  };
  const revisions: PushedRevisions = { skills: {}, sessions: {}, library: {} };

  for (const [id, { op, rev }] of Object.entries(sync.pendingSkills)) {
    revisions.skills[id] = rev;
    const skill = skillsById.get(id);
    if (op === 'delete') batch.skillDeletes.push(id);
    else if (skill) batch.skillUpserts.push(skill);
  }

  for (const [id, { op, rev }] of Object.entries(sync.pendingSessions)) {
    revisions.sessions[id] = rev;
    const session = sessionsById.get(id);
    if (op === 'delete') batch.sessionDeletes.push(id);
    // A session whose skill is gone locally has nothing to attach to remotely.
    else if (session && skillsById.has(session.skillId)) batch.sessionUpserts.push(session);
  }

  for (const [id, { op, rev }] of Object.entries(sync.pendingLibrary)) {
    revisions.library[id] = rev;
    const item = libraryById.get(id);
    if (op === 'delete') batch.libraryDeletes.push(id);
    else if (item) batch.libraryUpserts.push(item);
  }

  return { batch, revisions };
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
  const { skills, sessions, library, sync } = store.getState();
  const { batch, revisions } = planPush(skills, sessions, library, sync);

  if (!isEmpty(batch)) await remote.push(batch);
  store.getState().acknowledgePush(revisions);

  const { cursor, libraryCursor } = store.getState().sync;
  const changes = await remote.pull({ cursor, libraryCursor });
  store.getState().applyRemoteChanges(changes);
}
