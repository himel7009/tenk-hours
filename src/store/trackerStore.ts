import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toDayKey, type DayKey } from '../domain/dates';
import type { PinLock } from '../domain/pin';
import { elapsedMs, pause, resume } from '../domain/timer';
import { normalizeRoutine, type Weekday } from '../domain/routine';
import { cleanTodoTitle, type Todo, type TodoId } from '../domain/todos';
import {
  advancePomodoro as advancePomodoroPhase,
  startNextRound as startNextRoundOf,
  type PomodoroEvent,
  type PomodoroPlan,
} from '../domain/pomodoro';
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
const STORAGE_VERSION = 11;
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
  keepStreak: boolean;
  routineDays: Weekday[];
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
  todos: Todo[];
  activeTimer: ActiveTimer | null;
  theme: Theme;
  /**
   * Hides the bad habits behind a PIN on this device. Never synced: each
   * device has its own lock, and signing out removes it.
   */
  badHabitLock: PinLock | null;
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
  /** With a plan, the countdown is split into Pomodoro rounds and breaks. */
  startTimer: (
    skillId: SkillId,
    durationSeconds: number | null,
    plan?: PomodoroPlan | null,
  ) => void;
  /** Moves a Pomodoro session to its next phase if one is due. */
  advancePomodoro: () => PomodoroEvent;
  /** Skips the break, or starts the round waiting after it. */
  startNextRound: () => void;
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
  /** Sets the weekdays a domain, or a tracker outside a domain, is planned for. */
  setRoutine: (target: { domainId: DomainId } | { skillId: SkillId }, days: Weekday[]) => void;
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

  /** Adds a to-do; returns false if the title is empty. */
  addTodo: (title: string) => boolean;
  toggleTodo: (id: TodoId) => void;
  renameTodo: (id: TodoId, title: string) => void;
  deleteTodo: (id: TodoId) => void;
  /** Removes every done to-do. */
  clearDoneTodos: () => void;

  setTheme: (theme: Theme) => void;
  setBadHabitLock: (lock: PinLock | null) => void;
  replaceData: (
    data: Pick<
      TrackerState,
      'skills' | 'sessions' | 'library' | 'domains' | 'badHabits' | 'checkIns' | 'todos'
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
  todos: [],
  activeTimer: null,
  theme: 'system',
  badHabitLock: null,
  sync: initialSyncState,
};

type PendingKey =
  | 'pendingSkills'
  | 'pendingSessions'
  | 'pendingLibrary'
  | 'pendingDomains'
  | 'pendingBadHabits'
  | 'pendingCheckIns'
  | 'pendingTodos';

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

      startTimer: (skillId, durationSeconds, plan = null) =>
        set({
          activeTimer: {
            skillId,
            startedAt: Date.now(),
            durationSeconds,
            pausedAt: null,
            pausedMs: 0,
            // Rounds need an end to split up, so a stopwatch never has them.
            pomodoro:
              plan && durationSeconds !== null
                ? { plan, phase: 'focus', round: 0, breakEndsAt: null }
                : null,
          },
        }),

      advancePomodoro: () => {
        const timer = get().activeTimer;
        if (!timer?.pomodoro) return null;
        const { timer: next, event } = advancePomodoroPhase(timer, Date.now());
        if (next !== timer) set({ activeTimer: next });
        return event;
      },

      startNextRound: () =>
        set((state) => ({
          activeTimer: state.activeTimer && startNextRoundOf(state.activeTimer, Date.now()),
        })),

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
        const domain: Domain = {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          routineDays: [],
          ...input,
        };
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

      setRoutine: (target, days) => {
        const routineDays = normalizeRoutine(days);
        if ('domainId' in target) {
          set((state) => ({
            domains: state.domains.map((domain) =>
              domain.id === target.domainId ? { ...domain, routineDays } : domain,
            ),
            sync: markPending(state.sync, 'pendingDomains', [target.domainId], 'upsert'),
          }));
        } else {
          set((state) => ({
            skills: state.skills.map((skill) =>
              skill.id === target.skillId ? { ...skill, routineDays } : skill,
            ),
            sync: markPending(state.sync, 'pendingSkills', [target.skillId], 'upsert'),
          }));
        }
      },

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

      addTodo: (title) => {
        const clean = cleanTodoTitle(title);
        if (clean === null) return false;
        const todo: Todo = {
          id: crypto.randomUUID(),
          title: clean,
          done: false,
          createdAt: Date.now(),
          doneAt: null,
        };
        set((state) => ({
          todos: [...state.todos, todo],
          sync: markPending(state.sync, 'pendingTodos', [todo.id], 'upsert'),
        }));
        return true;
      },

      toggleTodo: (id) =>
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === id
              ? { ...todo, done: !todo.done, doneAt: todo.done ? null : Date.now() }
              : todo,
          ),
          sync: markPending(state.sync, 'pendingTodos', [id], 'upsert'),
        })),

      renameTodo: (id, title) => {
        const clean = cleanTodoTitle(title);
        if (clean === null) return;
        set((state) => ({
          todos: state.todos.map((todo) => (todo.id === id ? { ...todo, title: clean } : todo)),
          sync: markPending(state.sync, 'pendingTodos', [id], 'upsert'),
        }));
      },

      deleteTodo: (id) =>
        set((state) => ({
          todos: state.todos.filter((todo) => todo.id !== id),
          sync: markPending(state.sync, 'pendingTodos', [id], 'delete'),
        })),

      clearDoneTodos: () =>
        set((state) => {
          const done = state.todos.filter((todo) => todo.done).map((todo) => todo.id);
          return {
            todos: state.todos.filter((todo) => !todo.done),
            sync: markPending(state.sync, 'pendingTodos', done, 'delete'),
          };
        }),

      setTheme: (theme) => set({ theme }),

      setBadHabitLock: (badHabitLock) => set({ badHabitLock }),

      replaceData: ({ skills, sessions, library, domains, badHabits, checkIns, todos }) =>
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
          sync = markPending(sync, 'pendingTodos', ids(state.todos), 'delete');
          sync = markPending(sync, 'pendingSkills', ids(skills), 'upsert');
          sync = markPending(sync, 'pendingSessions', ids(sessions), 'upsert');
          sync = markPending(sync, 'pendingLibrary', ids(library), 'upsert');
          sync = markPending(sync, 'pendingDomains', ids(domains), 'upsert');
          sync = markPending(sync, 'pendingBadHabits', ids(badHabits), 'upsert');
          sync = markPending(sync, 'pendingCheckIns', ids(checkIns), 'upsert');
          sync = markPending(sync, 'pendingTodos', ids(todos), 'upsert');
          return {
            skills,
            sessions,
            library,
            domains,
            badHabits,
            checkIns,
            todos,
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
              todos: [],
              activeTimer: null,
              // The lock belonged to whoever used the device before.
              badHabitLock: null,
              sync: owned,
            };
          }
          let sync = markPending(owned, 'pendingSkills', ids(state.skills), 'upsert');
          sync = markPending(sync, 'pendingSessions', ids(state.sessions), 'upsert');
          sync = markPending(sync, 'pendingLibrary', ids(state.library), 'upsert');
          sync = markPending(sync, 'pendingDomains', ids(state.domains), 'upsert');
          sync = markPending(sync, 'pendingBadHabits', ids(state.badHabits), 'upsert');
          sync = markPending(sync, 'pendingCheckIns', ids(state.checkIns), 'upsert');
          sync = markPending(sync, 'pendingTodos', ids(state.todos), 'upsert');
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
            pendingTodos,
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

          const todos = new Map(state.todos.map((todo) => [todo.id, todo]));
          for (const { row, deleted } of changes.todos) {
            if (pendingTodos[row.id]) continue;
            if (deleted) todos.delete(row.id);
            else todos.set(row.id, row);
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
            todos: [...todos.values()],
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
            pendingTodos: withoutAcknowledged(state.sync.pendingTodos, pushed.todos),
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
        todos,
        activeTimer,
        theme,
        sync,
        badHabitLock,
      }) => ({
        skills,
        sessions,
        library,
        domains,
        badHabits,
        checkIns,
        todos,
        activeTimer,
        theme,
        sync,
        badHabitLock,
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
        // v7 predates the bad habits lock.
        if (version < 8) state.badHabitLock = null;
        // v8 timers had no Pomodoro rounds.
        if (version < 9 && state.activeTimer) state.activeTimer.pomodoro = null;
        // v9 predates optional streaks and routines. Nothing changes for
        // anyone: skills and habits keep their streaks, projects stay without.
        if (version < 10) {
          state.skills = (state.skills ?? []).map((skill) => ({
            ...skill,
            keepStreak: skill.kind !== 'project',
            routineDays: [],
          }));
          state.domains = (state.domains ?? []).map((domain) => ({ ...domain, routineDays: [] }));
        }
        // v10 predates to-dos.
        if (version < 11) {
          state.todos = [];
          state.sync = {
            ...(state.sync ?? initialSyncState),
            todoCursor: null,
            pendingTodos: {},
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
    sync.pendingTodos,
  ].some((pending) => Object.keys(pending).length > 0);
}

export function resetTrackerStore(): void {
  useTrackerStore.setState(initialState);
}
