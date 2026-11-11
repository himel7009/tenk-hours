import { Link } from 'react-router';
import { useAccountStore } from '../../store/accountStore';
import { hasPendingChanges, useTrackerStore } from '../../store/trackerStore';
import { isCloudEnabled } from '../../sync/supabaseClient';
import styles from './SyncIndicator.module.css';
import { syncLabel } from './syncLabel';

const SHORT: Record<string, string> = {
  syncing: 'Syncing',
  offline: 'Offline',
  error: 'Sync problem',
  idle: 'Synced',
};

/** Header item: a sign-in link for guests, sync status once signed in. */
export function SyncIndicator() {
  const ready = useAccountStore((state) => state.ready);
  const user = useAccountStore((state) => state.user);
  const phase = useAccountStore((state) => state.syncPhase);
  const pending = useTrackerStore((state) => hasPendingChanges(state.sync));

  if (!isCloudEnabled || !ready) return null;

  if (!user) {
    return (
      <Link to="/sign-in" className={styles.signIn}>
        Sign in
      </Link>
    );
  }

  const state = phase === 'idle' && pending ? 'syncing' : phase;
  return (
    <Link
      to="/settings"
      className={styles.status}
      data-state={state}
      title={syncLabel(phase, pending)}
    >
      <span className={styles.dot} aria-hidden="true" />
      {SHORT[state]}
    </Link>
  );
}
