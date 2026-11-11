import { create } from 'zustand';

export interface AccountUser {
  id: string;
  email: string;
}

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error';

interface AccountState {
  /** False until the saved session, if any, has been restored. */
  ready: boolean;
  user: AccountUser | null;
  /** True after arriving from a password reset email. */
  passwordRecovery: boolean;
  syncPhase: SyncPhase;
  lastSyncedAt: number | null;

  setUser: (user: AccountUser | null) => void;
  setPasswordRecovery: (active: boolean) => void;
  setSyncPhase: (phase: SyncPhase) => void;
}

/** Session and sync status. Not persisted: Supabase stores the session itself. */
export const useAccountStore = create<AccountState>()((set) => ({
  ready: false,
  user: null,
  passwordRecovery: false,
  syncPhase: 'idle',
  lastSyncedAt: null,

  setUser: (user) => set({ user, ready: true }),
  setPasswordRecovery: (passwordRecovery) => set({ passwordRecovery }),
  setSyncPhase: (syncPhase) =>
    set((state) => ({
      syncPhase,
      lastSyncedAt: syncPhase === 'idle' ? Date.now() : state.lastSyncedAt,
    })),
}));
