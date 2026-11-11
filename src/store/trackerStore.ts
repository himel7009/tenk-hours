import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toDayKey, type DayKey } from '../domain/dates';
import type {
  ActiveTimer,
  Session,
  SessionId,
  Skill,
  SkillColor,
  SkillId,
  Theme,
} from '../domain/types';
import {
  initialSyncState,
  type PendingChange,
  type PendingOp,
  type PushedRevisions,
  type RemoteChanges,
  type SyncState,
} from '../sync/types';

/** Bump when the persisted shape changes and add a step to `migrate`. */
const STORAGE_VERSION = 2;
const STORAGE_KEY = 'tenk';

/** Timer runs shorter than this are treated as accidental and not saved. */
export const MIN_TIMER_MS = 60_000;
/** A timer left running is capped at a day, the most one session can hold. */
const MAX_SESSION_MINUTES = 24 * 60;

export interface SkillInput {
  name: string;
  color: SkillColor;
  targetHours: number;
}

export interface SessionInput {
  day: DayKey;
  minutes: number;
  note: string;
}

interface TrackerState {
  skills: Skill[];
  sessions: Session[];
  activeTimer: ActiveTimer | null;
  theme: Theme;
  sync: SyncState;
}

interface TrackerActions {
  addSkill: (input: SkillInput) => SkillId;
  updateSkill: (id: SkillId, input: SkillInput) => void;
  /** Removes the skill and every session logged against it. */
  deleteSkill: (id: SkillId) => void;

  logSession: (skillId: SkillId, input: SessionInput) => void;
  updateSession: (id: SessionId, input: SessionInput) => void;
  deleteSession: (id: SessionId) => void;

  /** Starts a timer, replacing any running one without saving it. */
  startTimer: (skillId: SkillId) => void;
  /** Stops the timer. Returns the saved session, or null if the run was too short. */
  stopTimer: () => Session | null;
  discardTimer: () => void;

  setTheme: (theme: Theme) => void;
  replaceData: (data: Pick<TrackerState, 'skills' | 'sessions'>) => void;

  /**
   * Ties the local data to a signed-in account. Guest data is kept and queued
   * for upload; data left behind by a different account is dropped.
   */
  adoptAccount: (userId: string) => void;
  /** Merges rows pulled from the server. Unsynced local changes win. */
  applyRemoteChanges: (changes: RemoteChanges) => void;
  /** Clears pending entries a push covered, unless they changed again since. */
  acknowledgePush: (pushed: PushedRevisions) => void;
  /** Returns the device to an empty guest state. Used on sign-out. */
  clearLocalData: () => void;
}

export type TrackerStore = TrackerState & TrackerActions;

const initialState: TrackerState = {
  skills: [],
  sessions: [],
  activeTimer: null,
  theme: 'system',
  sync: initialSyncState,
};

type PendingKey = 'pendingSkills' | 'pendingSessions';

/** Records local changes for the next push. A no-op while used as a guest. */
function markPending(sync: SyncState, key: PendingKey, ids: string[], op: PendingOp): SyncState {
  if (sync.ownerId === null || ids.length === 0) return sync;
  const rev = sync.rev + 1;
  const pending: Record<string, PendingChange> = { ...sync[key] };
  for (const id of ids) pending[id] = { op, rev };
  return { ...sync, rev, [key]: pending };
}

function withoutAcknowledged(
  pending: Record<string, PendingChange>,
  pushed: Record<string, number>,
): Record<string, PendingChange> {
  return Object.fromEntries(
    Object.entries(pending).filter(([id, change]) => pushed[id] !== change.rev),
  );
}

export const useTrackerStore = create<TrackerStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addSkill: (input) => {
        const skill: Skill = { id: crypto.randomUUID(), createdAt: Date.now(), ...input };
        set((state) => ({
          skills: [...state.skills, skill],
          sync: markPending(state.sync, 'pendingSkills', [skill.id], 'upsert'),
        }));
        return skill.id;
      },

      updateSkill: (id, input) =>
        set((state) => ({
          skills: state.skills.map((skill) => (skill.id === id ? { ...skill, ...input } : skill)),
          sync: markPending(state.sync, 'pendingSkills', [id], 'upsert'),
        })),

      deleteSkill: (id) =>
        set((state) => {
          const sessionIds = state.sessions.filter((s) => s.skillId === id).map((s) => s.id);
          const sync = markPending(state.sync, 'pendingSkills', [id], 'delete');
          return {
            skills: state.skills.filter((skill) => skill.id !== id),
            sessions: state.sessions.filter((session) => session.skillId !== id),
            activeTimer: state.activeTimer?.skillId === id ? null : state.activeTimer,
            sync: markPending(sync, 'pendingSessions', sessionIds, 'delete'),
          };
        }),

      logSession: (skillId, input) => {
        const session: Session = {
          id: crypto.randomUUID(),
          skillId,
          source: 'manual',
          createdAt: Date.now(),
          ...input,
        };
        set((state) => ({
          sessions: [...state.sessions, session],
          sync: markPending(state.sync, 'pendingSessions', [session.id], 'upsert'),
        }));
      },

      updateSession: (id, input) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id ? { ...session, ...input } : session,
          ),
          sync: markPending(state.sync, 'pendingSessions', [id], 'upsert'),
        })),

      deleteSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((session) => session.id !== id),
          sync: markPending(state.sync, 'pendingSessions', [id], 'delete'),
        })),

      startTimer: (skillId) => set({ activeTimer: { skillId, startedAt: Date.now() } }),

      stopTimer: () => {
        const timer = get().activeTimer;
        if (!timer) return null;

        const elapsed = Date.now() - timer.startedAt;
        if (elapsed < MIN_TIMER_MS) {
          set({ activeTimer: null });
          return null;
        }

        const session: Session = {
          id: crypto.randomUUID(),
          skillId: timer.skillId,
          // A run that crosses midnight counts towards the day it started.
          day: toDayKey(new Date(timer.startedAt)),
          minutes: Math.min(MAX_SESSION_MINUTES, Math.round(elapsed / 60_000)),
          note: '',
          source: 'timer',
          createdAt: Date.now(),
        };
        set((state) => ({
          activeTimer: null,
          sessions: [...state.sessions, session],
          sync: markPending(state.sync, 'pendingSessions', [session.id], 'upsert'),
        }));
        return session;
      },

      discardTimer: () => set({ activeTimer: null }),

      setTheme: (theme) => set({ theme }),

      replaceData: ({ skills, sessions }) =>
        set((state) => {
          // Restoring a backup replaces the account's data too: everything
          // that was here is deleted remotely, then the backup is uploaded.
          let sync = state.sync;
          sync = markPending(sync, 'pendingSkills', ids(state.skills), 'delete');
          sync = markPending(sync, 'pendingSessions', ids(state.sessions), 'delete');
          sync = markPending(sync, 'pendingSkills', ids(skills), 'upsert');
          sync = markPending(sync, 'pendingSessions', ids(sessions), 'upsert');
          return { skills, sessions, activeTimer: null, sync };
        }),

      adoptAccount: (userId) =>
        set((state) => {
          const { ownerId } = state.sync;
          if (ownerId === userId) return state;

          const owned: SyncState = { ...initialSyncState, ownerId: userId };
          if (ownerId !== null) {
            return { skills: [], sessions: [], activeTimer: null, sync: owned };
          }
          const withSkills = markPending(owned, 'pendingSkills', ids(state.skills), 'upsert');
          return {
            sync: markPending(withSkills, 'pendingSessions', ids(state.sessions), 'upsert'),
          };
        }),

      applyRemoteChanges: (changes) =>
        set((state) => {
          const { pendingSkills, pendingSessions } = state.sync;

          const skills = new Map(state.skills.map((skill) => [skill.id, skill]));
          for (const { row, deleted } of changes.skills) {
            if (pendingSkills[row.id]) continue;
            if (deleted) skills.delete(row.id);
            else skills.set(row.id, row);
          }

          const sessions = new Map(state.sessions.map((session) => [session.id, session]));
          for (const { row, deleted } of changes.sessions) {
            if (pendingSessions[row.id]) continue;
            if (deleted) sessions.delete(row.id);
            else sessions.set(row.id, row);
          }

          const { activeTimer } = state;
          return {
            skills: [...skills.values()],
            // A skill deleted on another device takes its sessions with it.
            sessions: [...sessions.values()].filter((session) => skills.has(session.skillId)),
            activeTimer: activeTimer && skills.has(activeTimer.skillId) ? activeTimer : null,
            sync: { ...state.sync, cursor: changes.cursor ?? state.sync.cursor },
          };
        }),

      acknowledgePush: (pushed) =>
        set((state) => ({
          sync: {
            ...state.sync,
            pendingSkills: withoutAcknowledged(state.sync.pendingSkills, pushed.skills),
            pendingSessions: withoutAcknowledged(state.sync.pendingSessions, pushed.sessions),
          },
        })),

      clearLocalData: () => set((state) => ({ ...initialState, theme: state.theme })),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      partialize: ({ skills, sessions, activeTimer, theme, sync }) => ({
        skills,
        sessions,
        activeTimer,
        theme,
        sync,
      }),
      migrate: (persisted, version) => {
        const state = persisted as Partial<TrackerState>;
        // v1 predates accounts: everything in it is guest data.
        if (version < 2) state.sync = initialSyncState;
        return state as TrackerState;
      },
    },
  ),
);

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

export function hasPendingChanges(sync: SyncState): boolean {
  return Object.keys(sync.pendingSkills).length > 0 || Object.keys(sync.pendingSessions).length > 0;
}

export function resetTrackerStore(): void {
  useTrackerStore.setState(initialState);
}
