import { create } from 'zustand';
import { lockoutSeconds } from '../../domain/pin';
import { useTrackerStore } from '../../store/trackerStore';

interface LockSession {
  /** True once the PIN has been entered. Never saved, so a reload locks again. */
  unlocked: boolean;
  failures: number;
  /** Time before which no PIN is accepted, after too many wrong ones. */
  retryAt: number;
  unlock: () => void;
  lock: () => void;
  recordFailure: () => void;
}

export const useLockSession = create<LockSession>()((set) => ({
  unlocked: false,
  failures: 0,
  retryAt: 0,
  unlock: () => set({ unlocked: true, failures: 0, retryAt: 0 }),
  lock: () => set({ unlocked: false }),
  recordFailure: () =>
    set((state) => {
      const failures = state.failures + 1;
      return { failures, retryAt: Date.now() + lockoutSeconds(failures) * 1000 };
    }),
}));

/** Whether the bad habits are hidden right now on this device. */
export function useBadHabitsLocked(): boolean {
  const hasLock = useTrackerStore((state) => state.badHabitLock !== null);
  const unlocked = useLockSession((state) => state.unlocked);
  return hasLock && !unlocked;
}
