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

/** Bump when the persisted shape changes and add a step to `migrate`. */
const STORAGE_VERSION = 1;
const STORAGE_KEY = 'tenk';

/** Timer runs shorter than this are treated as accidental and not saved. */
export const MIN_TIMER_MS = 60_000;

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
}

export type TrackerStore = TrackerState & TrackerActions;

const initialState: TrackerState = {
  skills: [],
  sessions: [],
  activeTimer: null,
  theme: 'system',
};

export const useTrackerStore = create<TrackerStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addSkill: (input) => {
        const skill: Skill = { id: crypto.randomUUID(), createdAt: Date.now(), ...input };
        set((state) => ({ skills: [...state.skills, skill] }));
        return skill.id;
      },

      updateSkill: (id, input) =>
        set((state) => ({
          skills: state.skills.map((skill) => (skill.id === id ? { ...skill, ...input } : skill)),
        })),

      deleteSkill: (id) =>
        set((state) => ({
          skills: state.skills.filter((skill) => skill.id !== id),
          sessions: state.sessions.filter((session) => session.skillId !== id),
          activeTimer: state.activeTimer?.skillId === id ? null : state.activeTimer,
        })),

      logSession: (skillId, input) => {
        const session: Session = {
          id: crypto.randomUUID(),
          skillId,
          source: 'manual',
          createdAt: Date.now(),
          ...input,
        };
        set((state) => ({ sessions: [...state.sessions, session] }));
      },

      updateSession: (id, input) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id ? { ...session, ...input } : session,
          ),
        })),

      deleteSession: (id) =>
        set((state) => ({ sessions: state.sessions.filter((session) => session.id !== id) })),

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
          minutes: Math.round(elapsed / 60_000),
          note: '',
          source: 'timer',
          createdAt: Date.now(),
        };
        set((state) => ({ activeTimer: null, sessions: [...state.sessions, session] }));
        return session;
      },

      discardTimer: () => set({ activeTimer: null }),

      setTheme: (theme) => set({ theme }),

      replaceData: ({ skills, sessions }) => set({ skills, sessions, activeTimer: null }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      partialize: ({ skills, sessions, activeTimer, theme }) => ({
        skills,
        sessions,
        activeTimer,
        theme,
      }),
    },
  ),
);

export function resetTrackerStore(): void {
  useTrackerStore.setState(initialState);
}
