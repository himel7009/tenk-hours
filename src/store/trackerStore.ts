import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toDayKey, type DayKey } from '../domain/dates';
import type { Domain, DomainId } from '../domain/domains';
import type { LibraryItem, LibraryItemId } from '../domain/library';
import { DEFAULT_DAILY_GOAL_MINUTES, DEFAULT_ICONS, type TrackerKind } from '../domain/types';
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
const STORAGE_VERSION = 5;
const STORAGE_KEY = 'tenk';

/** Timer runs shorter than this are treated as accidental and not saved. */
export const MIN_TIMER_MS = 60_000;
/** A timer left running is capped at a day, the most one session can hold. */
const MAX_SESSION_MINUTES = 24 * 60;

export interface SkillInput {
  name: string;
  icon: string;
  color: SkillColor;
  targetHours: number;
  dailyGoalMinutes: number;
  domainId: DomainId | null;
}

export type DomainInput = Pick<Domain, 'name' | 'icon' | 'color'>;

/** Everything about a library item that a form can set. */
export type LibraryInput = Omit<LibraryItem, 'id' | 'createdAt'>;

export interface SessionInput {
  day: DayKey;
  minutes: number;
  note: string;
}

interface TrackerState {
  skills: Skill[];
  sessions: Session[];
  library: LibraryItem[];
  domains: Domain[];
  activeTimer: ActiveTimer | null;
  theme: Theme;
  sync: SyncState;
}

interface TrackerActions {
  addSkill: (kind: TrackerKind, input: SkillInput) => SkillId;
  updateSkill: (id: SkillId, input: SkillInput) => void;
  /** Removes the skill and every session logged against it. */
  deleteSkill: (id: SkillId) => void;

  logSession: (skillId: SkillId, input: SessionInput) => void;
  updateSession: (id: SessionId, input: SessionInput) => void;
  deleteSession: (id: SessionId) => void;

  /**
   * Starts a timer, replacing any running one without saving it. Pass a
   * duration for a countdown, or null for an open-ended stopwatch.
   */
  startTimer: (skillId: SkillId, durationMinutes: number | null) => void;
  /**
   * Stops the timer and saves the time spent, which for a countdown is never
   * more than its planned length. Returns the saved session, or null if the
   * run was too short.
   */
  stopTimer: () => Session | null;
  discardTimer: () => void;

  addDomain: (input: DomainInput) => DomainId;
  updateDomain: (id: DomainId, input: DomainInput) => void;
  /** Removes the domain. Its skills are kept and become standalone. */
  deleteDomain: (id: DomainId) => void;

  addLibraryItem: (input: LibraryInput) => void;
  updateLibraryItem: (id: LibraryItemId, input: LibraryInput) => void;
  deleteLibraryItem: (id: LibraryItemId) => void;

  setTheme: (theme: Theme) => void;
  replaceData: (data: Pick<TrackerState, 'skills' | 'sessions' | 'library' | 'domains'>) => void;

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
  library: [],
  domains: [],
  activeTimer: null,
  theme: 'system',
  sync: initialSyncState,
};

type PendingKey = 'pendingSkills' | 'pendingSessions' | 'pendingLibrary' | 'pendingDomains';

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

      addSkill: (kind, input) => {
        const skill: Skill = { id: crypto.randomUUID(), kind, createdAt: Date.now(), ...input };
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

      startTimer: (skillId, durationMinutes) =>
        set({ activeTimer: { skillId, startedAt: Date.now(), durationMinutes } }),

      stopTimer: () => {
        const timer = get().activeTimer;
        if (!timer) return null;

        const elapsed = Math.min(Date.now(), timerEndsAt(timer)) - timer.startedAt;
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

      addDomain: (input) => {
        const domain: Domain = { id: crypto.randomUUID(), createdAt: Date.now(), ...input };
        set((state) => ({
          domains: [...state.domains, domain],
          sync: markPending(state.sync, 'pendingDomains', [domain.id], 'upsert'),
        }));
        return domain.id;
      },

      updateDomain: (id, input) =>
        set((state) => ({
          domains: state.domains.map((domain) =>
            domain.id === id ? { ...domain, ...input } : domain,
          ),
          sync: markPending(state.sync, 'pendingDomains', [id], 'upsert'),
        })),

      deleteDomain: (id) =>
        set((state) => {
          const freed = state.skills.filter((skill) => skill.domainId === id).map((s) => s.id);
          const sync = markPending(state.sync, 'pendingDomains', [id], 'delete');
          return {
            domains: state.domains.filter((domain) => domain.id !== id),
            skills: state.skills.map((skill) =>
              skill.domainId === id ? { ...skill, domainId: null } : skill,
            ),
            sync: markPending(sync, 'pendingSkills', freed, 'upsert'),
          };
        }),

      addLibraryItem: (input) => {
        const item: LibraryItem = { id: crypto.randomUUID(), createdAt: Date.now(), ...input };
        set((state) => ({
          library: [...state.library, item],
          sync: markPending(state.sync, 'pendingLibrary', [item.id], 'upsert'),
        }));
      },

      updateLibraryItem: (id, input) =>
        set((state) => ({
          library: state.library.map((item) => (item.id === id ? { ...item, ...input } : item)),
          sync: markPending(state.sync, 'pendingLibrary', [id], 'upsert'),
        })),

      deleteLibraryItem: (id) =>
        set((state) => ({
          library: state.library.filter((item) => item.id !== id),
          sync: markPending(state.sync, 'pendingLibrary', [id], 'delete'),
        })),

      setTheme: (theme) => set({ theme }),

      replaceData: ({ skills, sessions, library, domains }) =>
        set((state) => {
          // Restoring a backup replaces the account's data too: everything
          // that was here is deleted remotely, then the backup is uploaded.
          let sync = state.sync;
          sync = markPending(sync, 'pendingSkills', ids(state.skills), 'delete');
          sync = markPending(sync, 'pendingSessions', ids(state.sessions), 'delete');
          sync = markPending(sync, 'pendingLibrary', ids(state.library), 'delete');
          sync = markPending(sync, 'pendingDomains', ids(state.domains), 'delete');
          sync = markPending(sync, 'pendingSkills', ids(skills), 'upsert');
          sync = markPending(sync, 'pendingSessions', ids(sessions), 'upsert');
          sync = markPending(sync, 'pendingLibrary', ids(library), 'upsert');
          sync = markPending(sync, 'pendingDomains', ids(domains), 'upsert');
          return { skills, sessions, library, domains, activeTimer: null, sync };
        }),

      adoptAccount: (userId) =>
        set((state) => {
          const { ownerId } = state.sync;
          if (ownerId === userId) return state;

          const owned: SyncState = { ...initialSyncState, ownerId: userId };
          if (ownerId !== null) {
            return {
              skills: [],
              sessions: [],
              library: [],
              domains: [],
              activeTimer: null,
              sync: owned,
            };
          }
          let sync = markPending(owned, 'pendingSkills', ids(state.skills), 'upsert');
          sync = markPending(sync, 'pendingSessions', ids(state.sessions), 'upsert');
          sync = markPending(sync, 'pendingLibrary', ids(state.library), 'upsert');
          sync = markPending(sync, 'pendingDomains', ids(state.domains), 'upsert');
          return { sync };
        }),

      applyRemoteChanges: (changes) =>
        set((state) => {
          const { pendingSkills, pendingSessions, pendingLibrary, pendingDomains } = state.sync;

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

          const library = new Map(state.library.map((item) => [item.id, item]));
          for (const { row, deleted } of changes.library) {
            if (pendingLibrary[row.id]) continue;
            if (deleted) library.delete(row.id);
            else library.set(row.id, row);
          }

          const domains = new Map(state.domains.map((domain) => [domain.id, domain]));
          for (const { row, deleted } of changes.domains) {
            if (pendingDomains[row.id]) continue;
            if (deleted) domains.delete(row.id);
            else domains.set(row.id, row);
          }

          // A skill whose domain was deleted on another device stands alone.
          const ungrouped = [...skills.values()].map((skill) =>
            skill.domainId !== null && !domains.has(skill.domainId)
              ? { ...skill, domainId: null }
              : skill,
          );

          const { activeTimer } = state;
          return {
            library: [...library.values()],
            domains: [...domains.values()],
            skills: ungrouped,
            // A skill deleted on another device takes its sessions with it.
            sessions: [...sessions.values()].filter((session) => skills.has(session.skillId)),
            activeTimer: activeTimer && skills.has(activeTimer.skillId) ? activeTimer : null,
            sync: { ...state.sync, ...changes.cursors },
          };
        }),

      acknowledgePush: (pushed) =>
        set((state) => ({
          sync: {
            ...state.sync,
            pendingSkills: withoutAcknowledged(state.sync.pendingSkills, pushed.skills),
            pendingSessions: withoutAcknowledged(state.sync.pendingSessions, pushed.sessions),
            pendingLibrary: withoutAcknowledged(state.sync.pendingLibrary, pushed.library),
            pendingDomains: withoutAcknowledged(state.sync.pendingDomains, pushed.domains),
          },
        })),

      clearLocalData: () => set((state) => ({ ...initialState, theme: state.theme })),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      partialize: ({ skills, sessions, library, domains, activeTimer, theme, sync }) => ({
        skills,
        sessions,
        library,
        domains,
        activeTimer,
        theme,
        sync,
      }),
      migrate: (persisted, version) => {
        const state = persisted as Partial<TrackerState>;
        // v1 predates accounts: everything in it is guest data.
        if (version < 2) state.sync = initialSyncState;
        // v2 predates habits, icons, daily goals and countdown timers.
        if (version < 3) {
          state.skills = (state.skills ?? []).map((skill) => ({
            ...skill,
            kind: 'skill',
            icon: DEFAULT_ICONS.skill,
            dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
          }));
          if (state.activeTimer) state.activeTimer.durationMinutes = null;
        }
        // v3 predates the library. Its cursor starts empty so the first sync
        // after upgrading pulls every library item already in the account.
        if (version < 4) {
          state.library = [];
          state.sync = {
            ...(state.sync ?? initialSyncState),
            libraryCursor: null,
            pendingLibrary: {},
          };
        }
        // v4 predates domains: every skill starts out standalone.
        if (version < 5) {
          state.domains = [];
          state.skills = (state.skills ?? []).map((skill) => ({ ...skill, domainId: null }));
          state.sync = {
            ...(state.sync ?? initialSyncState),
            domainCursor: null,
            pendingDomains: {},
          };
        }
        return state as TrackerState;
      },
    },
  ),
);

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

/** When a countdown finishes. Infinity for an open-ended timer. */
export function timerEndsAt(timer: ActiveTimer): number {
  return timer.durationMinutes === null
    ? Infinity
    : timer.startedAt + timer.durationMinutes * 60_000;
}

export function hasPendingChanges(sync: SyncState): boolean {
  return [sync.pendingSkills, sync.pendingSessions, sync.pendingLibrary, sync.pendingDomains].some(
    (pending) => Object.keys(pending).length > 0,
  );
}

export function resetTrackerStore(): void {
  useTrackerStore.setState(initialState);
}
