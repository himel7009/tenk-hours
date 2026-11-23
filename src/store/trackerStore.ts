import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toDayKey, type DayKey } from '../domain/dates';
import type { PinLock } from '../domain/pin';
import { elapsedMs, pause, resume } from '../domain/timer';
import {
  changeDay,
  inheritDomainRoutines,
  normalizeRoutine,
  type Weekday,
} from '../domain/routine';
import { DEBT_PERSON_MAX, type Debt, type DebtId, type DebtPayment } from '../domain/debts';
import { stableUuid } from '../domain/ids';
import {
  lookInUse,
  pickColor,
  planLookFixes,
  suggestEmoji,
  type AppearanceKind,
} from '../domain/appearance';
import {
  cleanNote,
  monthRange,
  type MoneyEntry,
  type MoneyEntryId,
  type MoneySection,
  type MoneySectionId,
} from '../domain/money';
import type { ImportedSheet } from '../domain/moneyImport';
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
const STORAGE_VERSION = 16;
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
  moneySections: MoneySection[];
  moneyEntries: MoneyEntry[];
  debts: Debt[];
  debtPayments: DebtPayment[];
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
  /** Turns a tracker's streak on or off. */
  setKeepStreak: (id: SkillId, keepStreak: boolean) => void;
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
  /**
   * Changes one day of a domain's, or a standalone tracker's, plan: `add` it
   * on top of the routine, `skip` it, or `reset` to the routine.
   */
  changeDayPlan: (
    target: { domainId: DomainId } | { skillId: SkillId },
    day: DayKey,
    change: 'add' | 'skip' | 'reset',
  ) => void;
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

  /** Adds a to-do for a domain, a skill or neither, on a day; false if the title is empty. */
  addTodo: (title: string, place: TodoPlace, deadline?: DayKey | null) => boolean;
  toggleTodo: (id: TodoId) => void;
  /** Changes the title, where it belongs, or its day. */
  updateTodo: (
    id: TodoId,
    patch: Partial<TodoPlace & { title: string; deadline: DayKey | null }>,
  ) => void;
  deleteTodo: (id: TodoId) => void;

  /**
   * Gives anything that repeats an older item's icon or colour a new one.
   * Returns how many items changed.
   */
  fixRepeatedLooks: () => number;
  addMoneySection: (input: MoneySectionInput) => MoneySectionId;
  updateMoneySection: (id: MoneySectionId, input: MoneySectionInput) => void;
  /** Removes a section with every entry in it or moved into it. */
  deleteMoneySection: (id: MoneySectionId) => void;
  addMoneyEntry: (input: MoneyEntryInput) => MoneyEntryId;
  updateMoneyEntry: (id: MoneyEntryId, input: MoneyEntryInput) => void;
  deleteMoneyEntry: (id: MoneyEntryId) => void;
  /**
   * Brings in a sheet: each of its sections goes into the matching existing
   * section, or a new one. Importing the same sheet again replaces its lines.
   */
  addDebt: (input: DebtInput) => DebtId;
  updateDebt: (id: DebtId, input: DebtInput) => void;
  /** Removes a debt with its payments. */
  deleteDebt: (id: DebtId) => void;
  addDebtPayment: (input: DebtPaymentInput) => void;
  deleteDebtPayment: (id: string) => void;
  importMoneySheet: (
    sheet: ImportedSheet,
    targets: Record<string, MoneySectionId | null>,
  ) => { entries: number; sections: number };

  setTheme: (theme: Theme) => void;
  setBadHabitLock: (lock: PinLock | null) => void;
  replaceData: (
    data: Pick<
      TrackerState,
      | 'skills'
      | 'sessions'
      | 'library'
      | 'domains'
      | 'badHabits'
      | 'checkIns'
      | 'todos'
      | 'moneySections'
      | 'moneyEntries'
      | 'debts'
      | 'debtPayments'
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
  moneySections: [],
  moneyEntries: [],
  debts: [],
  debtPayments: [],
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
  | 'pendingTodos'
  | 'pendingMoneySections'
  | 'pendingMoneyEntries'
  | 'pendingDebts'
  | 'pendingDebtPayments';

/** Records local changes for the next push. A no-op while used as a guest. */
export type MoneySectionInput = Pick<MoneySection, 'name' | 'icon' | 'color' | 'carryOver'>;
export type MoneyEntryInput = Pick<
  MoneyEntry,
  'sectionId' | 'kind' | 'toSectionId' | 'day' | 'amount' | 'note'
>;

export type TodoPlace = Pick<Todo, 'domainId' | 'skillId' | 'day'>;

/** A to-do sits in a domain or a skill, never both. */
function onePlace(place: TodoPlace): TodoPlace {
  return { ...place, skillId: place.domainId === null ? place.skillId : null };
}

export type DebtInput = Omit<Debt, 'id' | 'createdAt'>;
export type DebtPaymentInput = Omit<DebtPayment, 'id' | 'createdAt'>;

function cleanDebt(input: DebtInput): DebtInput {
  return {
    ...input,
    person: input.person.replace(/\s+/g, ' ').trim().slice(0, DEBT_PERSON_MAX) || 'Someone',
    amount: Math.max(1, Math.round(input.amount)),
    note: cleanNote(input.note),
  };
}

function normalizeEntry(input: MoneyEntryInput): MoneyEntryInput {
  return {
    ...input,
    // Only a move has somewhere to go.
    toSectionId: input.kind === 'move' ? input.toSectionId : null,
    amount: Math.max(1, Math.round(input.amount)),
    note: cleanNote(input.note),
  };
}

/** A sensible icon for a section from its name. */
/** The kinds of the collections passed to planLookFixes, in order. */
const LOOK_KINDS: AppearanceKind[] = ['skill', 'domain', 'badHabit', 'section'];

/** Every colour and icon in use across the app, but the item being edited. */
export function selectLookInUse(state: TrackerState, exceptId?: string) {
  return lookInUse([state.skills, state.domains, state.badHabits, state.moneySections], exceptId);
}

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

      setKeepStreak: (id, keepStreak) =>
        set((state) => ({
          skills: state.skills.map((skill) => (skill.id === id ? { ...skill, keepStreak } : skill)),
          sync: markPending(state.sync, 'pendingSkills', [id], 'upsert'),
        })),

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

      changeDayPlan: (target, day, change) => {
        if ('domainId' in target) {
          set((state) => ({
            domains: state.domains.map((domain) =>
              domain.id === target.domainId
                ? { ...domain, ...changeDay(domain, day, change) }
                : domain,
            ),
            sync: markPending(state.sync, 'pendingDomains', [target.domainId], 'upsert'),
          }));
        } else {
          set((state) => ({
            skills: state.skills.map((skill) =>
              skill.id === target.skillId ? { ...skill, ...changeDay(skill, day, change) } : skill,
            ),
            sync: markPending(state.sync, 'pendingSkills', [target.skillId], 'upsert'),
          }));
        }
      },

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

      addTodo: (title, place, deadline = null) => {
        const clean = cleanTodoTitle(title);
        if (clean === null) return false;
        const todo: Todo = {
          id: crypto.randomUUID(),
          title: clean,
          done: false,
          createdAt: Date.now(),
          doneAt: null,
          ...onePlace(place),
          deadline,
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

      updateTodo: (id, patch) => {
        const title = patch.title === undefined ? undefined : cleanTodoTitle(patch.title);
        if (title === null) return;
        set((state) => ({
          todos: state.todos.map((todo) => {
            if (todo.id !== id) return todo;
            const place = onePlace({
              domainId: patch.domainId === undefined ? todo.domainId : patch.domainId,
              skillId: patch.skillId === undefined ? todo.skillId : patch.skillId,
              day: patch.day ?? todo.day,
            });
            return {
              ...todo,
              ...place,
              title: title ?? todo.title,
              deadline: patch.deadline === undefined ? (todo.deadline ?? null) : patch.deadline,
            };
          }),
          sync: markPending(state.sync, 'pendingTodos', [id], 'upsert'),
        }));
      },

      deleteTodo: (id) =>
        set((state) => ({
          todos: state.todos.filter((todo) => todo.id !== id),
          sync: markPending(state.sync, 'pendingTodos', [id], 'delete'),
        })),

      fixRepeatedLooks: () => {
        const state = get();
        const fixes = planLookFixes(
          [state.skills, state.domains, state.badHabits, state.moneySections],
          LOOK_KINDS,
        );
        if (fixes.length === 0) return 0;
        const patch = <T extends { id: string; icon: string; color: SkillColor }>(
          items: T[],
          collection: number,
        ): T[] =>
          items.map((item) => {
            const fix = fixes.find((f) => f.collection === collection && f.id === item.id);
            return fix
              ? { ...item, icon: fix.icon ?? item.icon, color: fix.color ?? item.color }
              : item;
          });
        const changed = (collection: number) =>
          fixes.filter((f) => f.collection === collection).map((f) => f.id);
        set((current) => {
          let sync = markPending(current.sync, 'pendingSkills', changed(0), 'upsert');
          sync = markPending(sync, 'pendingDomains', changed(1), 'upsert');
          sync = markPending(sync, 'pendingBadHabits', changed(2), 'upsert');
          sync = markPending(sync, 'pendingMoneySections', changed(3), 'upsert');
          return {
            skills: patch(current.skills, 0),
            domains: patch(current.domains, 1),
            badHabits: patch(current.badHabits, 2),
            moneySections: patch(current.moneySections, 3),
            sync,
          };
        });
        return fixes.length;
      },

      addMoneySection: (input) => {
        const section: MoneySection = { id: crypto.randomUUID(), createdAt: Date.now(), ...input };
        set((state) => ({
          moneySections: [...state.moneySections, section],
          sync: markPending(state.sync, 'pendingMoneySections', [section.id], 'upsert'),
        }));
        return section.id;
      },

      updateMoneySection: (id, input) =>
        set((state) => ({
          moneySections: state.moneySections.map((section) =>
            section.id === id ? { ...section, ...input } : section,
          ),
          sync: markPending(state.sync, 'pendingMoneySections', [id], 'upsert'),
        })),

      deleteMoneySection: (id) =>
        set((state) => {
          const gone = state.moneyEntries
            .filter((entry) => entry.sectionId === id || entry.toSectionId === id)
            .map((entry) => entry.id);
          let sync = markPending(state.sync, 'pendingMoneyEntries', gone, 'delete');
          sync = markPending(sync, 'pendingMoneySections', [id], 'delete');
          // Debts outlive the section they touched; they just no longer name it.
          const detachedDebts = state.debts.filter((debt) => debt.sectionId === id);
          const detachedPayments = state.debtPayments.filter((p) => p.sectionId === id);
          sync = markPending(sync, 'pendingDebts', ids(detachedDebts), 'upsert');
          sync = markPending(sync, 'pendingDebtPayments', ids(detachedPayments), 'upsert');
          return {
            debts: state.debts.map((debt) =>
              debt.sectionId === id ? { ...debt, sectionId: null } : debt,
            ),
            debtPayments: state.debtPayments.map((payment) =>
              payment.sectionId === id ? { ...payment, sectionId: null } : payment,
            ),
            moneySections: state.moneySections.filter((section) => section.id !== id),
            moneyEntries: state.moneyEntries.filter(
              (entry) => entry.sectionId !== id && entry.toSectionId !== id,
            ),
            sync,
          };
        }),

      addMoneyEntry: (input) => {
        const entry: MoneyEntry = {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          ...normalizeEntry(input),
        };
        set((state) => ({
          moneyEntries: [...state.moneyEntries, entry],
          sync: markPending(state.sync, 'pendingMoneyEntries', [entry.id], 'upsert'),
        }));
        return entry.id;
      },

      updateMoneyEntry: (id, input) =>
        set((state) => ({
          moneyEntries: state.moneyEntries.map((entry) =>
            entry.id === id ? { ...entry, ...normalizeEntry(input) } : entry,
          ),
          sync: markPending(state.sync, 'pendingMoneyEntries', [id], 'upsert'),
        })),

      deleteMoneyEntry: (id) =>
        set((state) => ({
          moneyEntries: state.moneyEntries.filter((entry) => entry.id !== id),
          sync: markPending(state.sync, 'pendingMoneyEntries', [id], 'delete'),
        })),

      addDebt: (input) => {
        const debt: Debt = { id: crypto.randomUUID(), createdAt: Date.now(), ...cleanDebt(input) };
        set((state) => ({
          debts: [...state.debts, debt],
          sync: markPending(state.sync, 'pendingDebts', [debt.id], 'upsert'),
        }));
        return debt.id;
      },

      updateDebt: (id, input) =>
        set((state) => ({
          debts: state.debts.map((debt) =>
            debt.id === id ? { ...debt, ...cleanDebt(input) } : debt,
          ),
          sync: markPending(state.sync, 'pendingDebts', [id], 'upsert'),
        })),

      deleteDebt: (id) =>
        set((state) => {
          const gone = state.debtPayments.filter((p) => p.debtId === id).map((p) => p.id);
          let sync = markPending(state.sync, 'pendingDebtPayments', gone, 'delete');
          sync = markPending(sync, 'pendingDebts', [id], 'delete');
          return {
            debts: state.debts.filter((debt) => debt.id !== id),
            debtPayments: state.debtPayments.filter((p) => p.debtId !== id),
            sync,
          };
        }),

      addDebtPayment: (input) => {
        const payment: DebtPayment = {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          ...input,
          amount: Math.max(1, Math.round(input.amount)),
          note: cleanNote(input.note),
        };
        set((state) => ({
          debtPayments: [...state.debtPayments, payment],
          sync: markPending(state.sync, 'pendingDebtPayments', [payment.id], 'upsert'),
        }));
      },

      deleteDebtPayment: (id) =>
        set((state) => ({
          debtPayments: state.debtPayments.filter((p) => p.id !== id),
          sync: markPending(state.sync, 'pendingDebtPayments', [id], 'delete'),
        })),

      importMoneySheet: (sheet, targets) => {
        const now = Date.now();
        const created: MoneySection[] = [];
        const imported: MoneyEntry[] = [];
        const { start } = monthRange(sheet.month);
        const look = selectLookInUse(get());
        sheet.sections.forEach((part) => {
          let sectionId = targets[part.name] ?? null;
          if (sectionId === null) {
            const section: MoneySection = {
              id: crypto.randomUUID(),
              name: part.name.slice(0, 60),
              icon: suggestEmoji(part.name, look.icons, 'section'),
              color: pickColor(look.colors),
              // A fund or savings pot usually keeps its balance month to month.
              carryOver: /fund|saving/i.test(part.name),
              createdAt: now,
            };
            created.push(section);
            look.icons.push(section.icon);
            look.colors.push(section.color);
            sectionId = section.id;
          }
          if (part.budget > 0) {
            imported.push({
              id: stableUuid(`import:${sheet.month}:${part.name.toLowerCase()}:budget`),
              sectionId,
              kind: 'add',
              toSectionId: null,
              day: start,
              amount: part.budget,
              note: 'Budget',
              createdAt: now,
            });
          }
          part.items.forEach((item, position) =>
            imported.push({
              id: item.id,
              sectionId: sectionId!,
              kind: 'spend',
              toSectionId: null,
              day: item.day,
              amount: item.amount,
              note: item.note,
              createdAt: now + position,
            }),
          );
        });
        set((state) => {
          const ids = new Set(imported.map((entry) => entry.id));
          let sync = markPending(
            state.sync,
            'pendingMoneySections',
            created.map((s) => s.id),
            'upsert',
          );
          sync = markPending(sync, 'pendingMoneyEntries', [...ids], 'upsert');
          return {
            moneySections: [...state.moneySections, ...created],
            moneyEntries: [
              ...state.moneyEntries.filter((entry) => !ids.has(entry.id)),
              ...imported,
            ],
            sync,
          };
        });
        return { entries: imported.length, sections: created.length };
      },

      setTheme: (theme) => set({ theme }),

      setBadHabitLock: (badHabitLock) => set({ badHabitLock }),

      replaceData: ({
        skills,
        sessions,
        library,
        domains,
        badHabits,
        checkIns,
        todos,
        moneySections,
        moneyEntries,
        debts,
        debtPayments,
      }) =>
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
          sync = markPending(sync, 'pendingMoneyEntries', ids(state.moneyEntries), 'delete');
          sync = markPending(sync, 'pendingMoneySections', ids(state.moneySections), 'delete');
          sync = markPending(sync, 'pendingDebtPayments', ids(state.debtPayments), 'delete');
          sync = markPending(sync, 'pendingDebts', ids(state.debts), 'delete');
          sync = markPending(sync, 'pendingSkills', ids(skills), 'upsert');
          sync = markPending(sync, 'pendingSessions', ids(sessions), 'upsert');
          sync = markPending(sync, 'pendingLibrary', ids(library), 'upsert');
          sync = markPending(sync, 'pendingDomains', ids(domains), 'upsert');
          sync = markPending(sync, 'pendingBadHabits', ids(badHabits), 'upsert');
          sync = markPending(sync, 'pendingCheckIns', ids(checkIns), 'upsert');
          sync = markPending(sync, 'pendingTodos', ids(todos), 'upsert');
          sync = markPending(sync, 'pendingMoneySections', ids(moneySections), 'upsert');
          sync = markPending(sync, 'pendingMoneyEntries', ids(moneyEntries), 'upsert');
          sync = markPending(sync, 'pendingDebts', ids(debts), 'upsert');
          sync = markPending(sync, 'pendingDebtPayments', ids(debtPayments), 'upsert');
          return {
            skills,
            sessions,
            library,
            domains,
            badHabits,
            checkIns,
            todos,
            moneySections,
            moneyEntries,
            debts,
            debtPayments,
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
              moneySections: [],
              moneyEntries: [],
              debts: [],
              debtPayments: [],
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
          sync = markPending(sync, 'pendingMoneySections', ids(state.moneySections), 'upsert');
          sync = markPending(sync, 'pendingMoneyEntries', ids(state.moneyEntries), 'upsert');
          sync = markPending(sync, 'pendingDebts', ids(state.debts), 'upsert');
          sync = markPending(sync, 'pendingDebtPayments', ids(state.debtPayments), 'upsert');
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
            pendingMoneySections,
            pendingMoneyEntries,
            pendingDebts,
            pendingDebtPayments,
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

          const moneySections = new Map(state.moneySections.map((s) => [s.id, s]));
          for (const { row, deleted } of changes.moneySections) {
            if (pendingMoneySections[row.id]) continue;
            if (deleted) moneySections.delete(row.id);
            else moneySections.set(row.id, row);
          }
          const moneyEntries = new Map(state.moneyEntries.map((e) => [e.id, e]));
          for (const { row, deleted } of changes.moneyEntries) {
            if (pendingMoneyEntries[row.id]) continue;
            if (deleted) moneyEntries.delete(row.id);
            else moneyEntries.set(row.id, row);
          }

          const debts = new Map(state.debts.map((d) => [d.id, d]));
          for (const { row, deleted } of changes.debts) {
            if (pendingDebts[row.id]) continue;
            if (deleted) debts.delete(row.id);
            else debts.set(row.id, row);
          }
          const debtPayments = new Map(state.debtPayments.map((p) => [p.id, p]));
          for (const { row, deleted } of changes.debtPayments) {
            if (pendingDebtPayments[row.id]) continue;
            if (deleted) debtPayments.delete(row.id);
            else debtPayments.set(row.id, row);
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
            moneySections: [...moneySections.values()],
            debts: [...debts.values()],
            // A debt deleted on another device takes its payments with it.
            debtPayments: [...debtPayments.values()].filter((p) => debts.has(p.debtId)),
            // A section deleted on another device takes its entries with it.
            moneyEntries: [...moneyEntries.values()].filter(
              (entry) =>
                moneySections.has(entry.sectionId) &&
                (entry.toSectionId === null || moneySections.has(entry.toSectionId)),
            ),
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
            pendingMoneySections: withoutAcknowledged(
              state.sync.pendingMoneySections,
              pushed.moneySections,
            ),
            pendingMoneyEntries: withoutAcknowledged(
              state.sync.pendingMoneyEntries,
              pushed.moneyEntries,
            ),
            pendingDebts: withoutAcknowledged(state.sync.pendingDebts, pushed.debts),
            pendingDebtPayments: withoutAcknowledged(
              state.sync.pendingDebtPayments,
              pushed.debtPayments,
            ),
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
        moneySections,
        moneyEntries,
        debts,
        debtPayments,
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
        moneySections,
        moneyEntries,
        debts,
        debtPayments,
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
        // v12 to-dos had no place or day: General, on the day they were written.
        if (version >= 11 && version < 13) {
          state.todos = (state.todos ?? []).map((todo) => ({
            ...todo,
            domainId: todo.domainId ?? null,
            skillId: todo.skillId ?? null,
            day: todo.day ?? toDayKey(new Date(todo.createdAt)),
          }));
        }
        // Up to v15 a skill in a domain followed the domain's days. From v16
        // every tracker has its own, so each takes its domain's to start.
        // The server copies the same in the matching migration.
        if (version < 16) {
          state.skills = inheritDomainRoutines(state.skills ?? [], state.domains ?? []);
        }
        // v14 debts all changed section balances; from v15 that is a choice,
        // off unless set, since borrowed money was usually already budgeted.
        if (version === 14) {
          state.debts = (state.debts ?? []).map((debt) => ({ ...debt, inBudget: false }));
        }
        // v13 predates debts.
        if (version < 14) {
          state.debts = [];
          state.debtPayments = [];
          state.sync = {
            ...(state.sync ?? initialSyncState),
            pendingDebts: {},
            pendingDebtPayments: {},
          };
        }
        // v11 predates money.
        if (version < 12) {
          state.moneySections = [];
          state.moneyEntries = [];
          state.sync = {
            ...(state.sync ?? initialSyncState),
            moneyCursor: null,
            pendingMoneySections: {},
            pendingMoneyEntries: {},
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
    sync.pendingMoneySections,
    sync.pendingMoneyEntries,
    sync.pendingDebts,
    sync.pendingDebtPayments,
  ].some((pending) => Object.keys(pending).length > 0);
}

export function resetTrackerStore(): void {
  useTrackerStore.setState(initialState);
}
