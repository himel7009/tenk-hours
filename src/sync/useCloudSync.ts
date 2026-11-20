import { useEffect } from 'react';
import { useAccountStore } from '../store/accountStore';
import { useToastStore } from '../store/toastStore';
import { useTrackerStore } from '../store/trackerStore';
import { supabase } from './supabaseClient';
import { createSupabaseRemote } from './supabaseRemote';
import { createSyncController, type SyncController } from './syncController';

/** Wait for a burst of edits to finish before pushing. */
const PUSH_DEBOUNCE_MS = 1000;
/**
 * How often an open tab checks for changes made on other devices. Live
 * updates usually get there first; this catches anything they miss, such as
 * changes made while the connection was down.
 */
const POLL_INTERVAL_MS = 60_000;
/** A burst of row changes from another device becomes one pull. */
const LIVE_DEBOUNCE_MS = 400;
/** Every synced table, watched for live updates. */
const LIVE_TABLES = [
  'skills',
  'sessions',
  'domains',
  'library_items',
  'bad_habits',
  'bad_habit_checkins',
  'todos',
  'money_sections',
  'money_entries',
  'money_debts',
  'money_debt_payments',
] as const;

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
 * changes, as soon as another device changes something (live updates), when
 * the tab regains focus or the network, and on a slow poll.
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
    // A change on another device pulls here within a second or two. The
    // notice only says something changed; the sync fetches the rows.
    const client = supabase;
    const live = client.channel(`tenk-sync-${userId}`);
    for (const table of LIVE_TABLES) {
      live.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
        () => controller.request(LIVE_DEBOUNCE_MS),
      );
    }
    live.subscribe((status) => {
      // Catch up on anything missed while the connection was down.
      if (status === 'SUBSCRIBED') controller.request();
    });

    const syncIfVisible = () => {
      if (document.visibilityState === 'visible') controller.request();
    };
    const interval = window.setInterval(syncIfVisible, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', syncIfVisible);
    window.addEventListener('online', syncIfVisible);

    return () => {
      unsubscribe();
      void client.removeChannel(live);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', syncIfVisible);
      window.removeEventListener('online', syncIfVisible);
      controller.dispose();
      if (activeController === controller) activeController = null;
    };
  }, [userId]);
}
