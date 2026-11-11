import { useEffect } from 'react';
import { useAccountStore } from '../store/accountStore';
import { useToastStore } from '../store/toastStore';
import { useTrackerStore } from '../store/trackerStore';
import { supabase } from './supabaseClient';
import { createSupabaseRemote } from './supabaseRemote';
import { createSyncController, type SyncController } from './syncController';

/** Wait for a burst of edits to finish before pushing. */
const PUSH_DEBOUNCE_MS = 1000;
/** How often an open tab checks for changes made on other devices. */
const POLL_INTERVAL_MS = 60_000;

let activeController: SyncController | null = null;

/** Syncs now if signed in, and resolves once nothing is left running. */
export async function syncNow(): Promise<void> {
  activeController?.request();
  await activeController?.settle();
}

/** Keeps the account store in step with Supabase's auth state. */
function useAuthSession(): void {
  useEffect(() => {
    if (!supabase) return;

    // OAuth failures come back as query parameters on the redirect.
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('error_description');
    if (authError) {
      useToastStore.getState().show(`Sign-in failed: ${authError}`);
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      useAccountStore
        .getState()
        .setUser(user ? { id: user.id, email: user.email ?? 'your account' } : null);
      if (user) useTrackerStore.getState().adoptAccount(user.id);
      if (event === 'PASSWORD_RECOVERY') useAccountStore.getState().setPasswordRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
}

/**
 * Mount once. While someone is signed in this syncs on sign-in, after local
 * changes, when the tab regains focus or the network, and on a slow poll.
 */
export function useCloudSync(): void {
  useAuthSession();
  const userId = useAccountStore((state) => state.user?.id);

  useEffect(() => {
    if (!supabase || !userId) return;

    const controller = createSyncController(
      createSupabaseRemote(supabase),
      useTrackerStore,
      useAccountStore.getState().setSyncPhase,
    );
    activeController = controller;
    controller.request();

    const unsubscribe = useTrackerStore.subscribe((state, previous) => {
      if (state.sync.rev !== previous.sync.rev) controller.request(PUSH_DEBOUNCE_MS);
    });
    const syncIfVisible = () => {
      if (document.visibilityState === 'visible') controller.request();
    };
    const interval = window.setInterval(syncIfVisible, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', syncIfVisible);
    window.addEventListener('online', syncIfVisible);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', syncIfVisible);
      window.removeEventListener('online', syncIfVisible);
      controller.dispose();
      if (activeController === controller) activeController = null;
    };
  }, [userId]);
}
