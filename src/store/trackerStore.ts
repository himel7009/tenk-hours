import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toDayKey, type DayKey } from '../domain/dates';
import { elapsedMs, pause, resume } from '../domain/timer';
import {
  checkInId,
  type BadHabit,
  type BadHabitId,
  type CheckIn,
  type CheckInStatus,
} from '../domain/badHabits';
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
const STORAGE_VERSION = 7;
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
export type BadHabitInput = Pick<BadHabit, 'name' | 'icon' | 'color'>;

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
  badHabits: BadHabit[];
  checkIns: CheckIn[];
  activeTimer: ActiveTimer | null;
  theme: Theme;
  sync: SyncState;
}

interface TrackerActions {
  addSkill: (kind: TrackerKind, input: SkillInput) => SkillId;
  /** Changes a skill. Passing a kind switches a skill to a project or back. */
  updateSkill: (id: SkillId, input: SkillInput & { kind?: TrackerKind }) => void;
  /** Removes the skill and every session logged against it. */
  deleteSkill: (id: SkillId) => void;

  logSession: (skillId: SkillId, input: SessionInput) => void;
  updateSession: (id: SessionId, input: SessionInput) => void;
  deleteSession: (id: SessionId) => void;

  /**
   * Starts a timer, replacing any running one without saving it. Pass a
   * duration in seconds for a countdown, or null for an open-ended stopwatch.
   */
  startTimer: (skillId: SkillId, durationSeconds: number | null) => void;
  /** Stops the clock without ending the session. */
  pauseTimer: () => void;
  resumeTimer: () => void;
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

  addBadHabit: (input: BadHabitInput) => BadHabitId;
  updateBadHabit: (id: BadHabitId, input: BadHabitInput) => void;
  /** Removes the bad habit and every answer logged for it. */
  deleteBadHabit: (id: BadHabitId) => void;
  /** Records whether a bad habit was avoided on a day. Null clears the answer. */
  setCheckIn: (habitId: BadHabitId, day: DayKey, status: CheckInStatus | null) => void;

  addLibraryItem: (input: LibraryInput) => void;
  updateLibraryItem: (id: LibraryItemId, input: LibraryInput) => void;
  deleteLibraryItem: (id: LibraryItemId) => void;

  setTheme: (theme: Theme) => void;
  replaceData: (
    data: Pick<
      TrackerState,
      'skills' | 'sessions' | 'library' | 'domains' | 'badHabits' | 'checkIns'
    >,
  ) => void;

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
  badHabits: [],
  checkIns: [],
  activeTimer: null,
  theme: 'system',
  sync: initialSyncState,
};

type PendingKey =
  | 'pendingSkills'
  | 'pendingSessions'
  | 'pendingLibrary'
  | 'pendingDomains'
  | 'pendingBadHabits'
  | 'pendingCheckIns';

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

      startTimer: (skillId, durationSeconds) =>
        set({
          activeTimer: {
            skillId,
            startedAt: Date.now(),
            durationSeconds,
            pausedAt: null,
            pausedMs: 0,
          },
        }),

      pauseTimer: () =>
        set((state) => ({
          activeTimer: state.activeTimer && pause(state.activeTimer, Date.now()),
        })),

      resumeTimer: () =>
        set((state) => ({
          activeTimer: state.activeTimer && resume(state.activeTimer, Date.now()),
        })),

      stopTimer: () => {
        const timer = get().activeTimer;
        if (!timer) return null;

        const elapsed = elapsedMs(timer, Date.now());
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

      addBadHabit: (input) => {
        const habit: BadHabit = { id: crypto.randomUUID(), createdAt: Date.now(), ...input };
        set((state) => ({
          badHabits: [...state.badHabits, habit],
          sync: markPending(state.sync, 'pendingBadHabits', [habit.id], 'upsert'),
        }));
        return habit.id;
      },

      updateBadHabit: (id, input) =>
        set((state) => ({
          badHabits: state.badHabits.map((habit) =>
            habit.id === id ? { ...habit, ...input } : habit,
          ),
          sync: markPending(state.sync, 'pendingBadHabits', [id], 'upsert'),
        })),

      deleteBadHabit: (id) =>
        set((state) => {
          const answers = state.checkIns.filter((c) => c.habitId === id).map((c) => c.id);
          const sync = markPending(state.sync, 'pendingBadHabits', [id], 'delete');
          return {
            badHabits: state.badHabits.filter((habit) => habit.id !== id),
            checkIns: state.checkIns.filter((checkIn) => checkIn.habitId !== id),
            sync: markPending(sync, 'pendingCheckIns', answers, 'delete'),
          };
        }),

      setCheckIn: (habitId, day, status) =>
        set((state) => {
          const id = checkInId(habitId, day);
          const others = state.checkIns.filter((checkIn) => checkIn.id !== id);
          if (status === null) {
            return {
              checkIns: others,
              sync: markPending(state.sync, 'pendingCheckIns', [id], 'delete'),
            };
          }
          const checkIn: CheckIn = { id, habitId, day, status, createdAt: Date.now() };
          return {
            checkIns: [...others, checkIn],
            sync: markPending(state.sync, 'pendingCheckIns', [id], 'upsert'),
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

      replaceData: ({ skills, sessions, library, domains, badHabits, checkIns }) =>
        set((state) => {
          // Restoring a backup replaces the account's data too: everything
          // that was here is deleted remotely, then the backup is uploaded.
          let sync = state.sync;
          sync = markPending(sync, 'pendingSkills', ids(state.skills), 'delete');
          sync = markPending(sync, 'pendingSessions', ids(state.sessions), 'delete');
          sync = markPending(sync, 'pendingLibrary', ids(state.library), 'delete');
          sync = markPending(sync, 'pendingDomains', ids(state.domains), 'delete');
          sync = markPending(sync, 'pendingBadHabits', ids(state.badHabits), 'delete');
          sync = markPending(sync, 'pendingCheckIns', ids(state.checkIns), 'delete');
          sync = markPending(sync, 'pendingSkills', ids(skills), 'upsert');
          sync = markPending(sync, 'pendingSessions', ids(sessions), 'upsert');
          sync = markPending(sync, 'pendingLibrary', ids(library), 'upsert');
          sync = markPending(sync, 'pendingDomains', ids(domains), 'upsert');
          sync = markPending(sync, 'pendingBadHabits', ids(badHabits), 'upsert');
          sync = markPending(sync, 'pendingCheckIns', ids(checkIns), 'upsert');
          return {
            skills,
            sessions,
            library,
            domains,
            badHabits,
            checkIns,
            activeTimer: null,
            sync,
          };
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
              badHabits: [],
              checkIns: [],
              activeTimer: null,
              sync: owned,
            };
          }
          let sync = markPending(owned, 'pendingSkills', ids(state.skills), 'upsert');
          sync = markPending(sync, 'pendingSessions', ids(state.sessions), 'upsert');
          sync = markPending(sync, 'pendingLibrary', ids(state.library), 'upsert');
          sync = markPending(sync, 'pendingDomains', ids(state.domains), 'upsert');
          sync = markPending(sync, 'pendingBadHabits', ids(state.badHabits), 'upsert');
          sync = markPending(sync, 'pendingCheckIns', ids(state.checkIns), 'upsert');
          return { sync };
        }),

      applyRemoteChanges: (changes) =>
        set((state) => {
          const {
            pendingSkills,
            pendingSessions,
            pendingLibrary,
            pendingDomains,
            pendingBadHabits,
            pendingCheckIns,
          } = state.sync;

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

          const badHabits = new Map(state.badHabits.map((habit) => [habit.id, habit]));
          for (const { row, deleted } of changes.badHabits) {
            if (pendingBadHabits[row.id]) continue;
            if (deleted) badHabits.delete(row.id);
            else badHabits.set(row.id, row);
          }

          const checkIns = new Map(state.checkIns.map((checkIn) => [checkIn.id, checkIn]));
          for (const { row, deleted } of changes.checkIns) {
            if (pendingCheckIns[row.id]) continue;
            if (deleted) checkIns.delete(row.id);
            else checkIns.set(row.id, row);
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
            badHabits: [...badHabits.values()],
            // A bad habit deleted on another device takes its answers with it.
            checkIns: [...checkIns.values()].filter((c) => badHabits.has(c.habitId)),
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
            pendingBadHabits: withoutAcknowledged(state.sync.pendingBadHabits, pushed.badHabits),
            pendingCheckIns: withoutAcknowledged(state.sync.pendingCheckIns, pushed.checkIns),
          },
        })),

      clearLocalData: () => set((state) => ({ ...initialState, theme: state.theme })),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      partialize: ({
        skills,
        sessions,
        library,
        domains,
        badHabits,
        checkIns,
        activeTimer,
        theme,
        sync,
      }) => ({
        skills,
        sessions,
        library,
        domains,
        badHabits,
        checkIns,
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
          if (state.activeTimer) {
            (state.activeTimer as unknown as { durationMinutes: null }).durationMinutes = null;
          }
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
        // v5 timers had a length in minutes and could not be paused.
        if (version < 6 && state.activeTimer) {
          const old = state.activeTimer as ActiveTimer & { durationMinutes?: number | null };
          const { durationMinutes = null, ...rest } = old;
          state.activeTimer = {
            ...rest,
            durationSeconds: durationMinutes === null ? null : durationMinutes * 60,
            pausedAt: null,
            pausedMs: 0,
          };
        }
        // v6 predates bad habits.
        if (version < 7) {
          state.badHabits = [];
          state.checkIns = [];
          state.sync = {
            ...(state.sync ?? initialSyncState),
            badHabitCursor: null,
            pendingBadHabits: {},
            pendingCheckIns: {},
          };
        }
        return state as TrackerState;
      },
    },
  ),
);

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

export function hasPendingChanges(sync: SyncState): boolean {
  return [
    sync.pendingSkills,
    sync.pendingSessions,
    sync.pendingLibrary,
    sync.pendingDomains,
    sync.pendingBadHabits,
    sync.pendingCheckIns,
  ].some((pending) => Object.keys(pending).length > 0);
}

export function resetTrackerStore(): void {
  useTrackerStore.setState(initialState);
}
