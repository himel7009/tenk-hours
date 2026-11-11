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
  /** Server timestamp of the newest row pulled so far. */
  cursor: string | null;
  /** Counter bumped on every local change while an account owns the data. */
  rev: number;
  pendingSkills: Record<SkillId, PendingChange>;
  pendingSessions: Record<SessionId, PendingChange>;
}

export const initialSyncState: SyncState = {
  ownerId: null,
  cursor: null,
  rev: 0,
  pendingSkills: {},
  pendingSessions: {},
};

export interface RemoteRow<T> {
  row: T;
  deleted: boolean;
}

/** Rows changed on the server since a cursor. */
export interface RemoteChanges {
  skills: RemoteRow<Skill>[];
  sessions: RemoteRow<Session>[];
  /** Cursor to store for the next pull, or null if nothing changed. */
  cursor: string | null;
}

export interface PushBatch {
  skillUpserts: Skill[];
  sessionUpserts: Session[];
  skillDeletes: SkillId[];
  sessionDeletes: SessionId[];
}

/** The revisions a push covered, so only unchanged entries are cleared. */
export interface PushedRevisions {
  skills: Record<SkillId, number>;
  sessions: Record<SessionId, number>;
}

/**
 * The server as the sync engine sees it. The Supabase implementation lives in
 * supabaseRemote.ts; tests use an in-memory one.
 */
export interface RemoteStore {
  push(batch: PushBatch): Promise<void>;
  pull(cursor: string | null): Promise<RemoteChanges>;
}
