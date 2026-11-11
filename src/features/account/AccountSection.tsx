import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { useAccountStore } from '../../store/accountStore';
import { useToastStore } from '../../store/toastStore';
import { hasPendingChanges, useTrackerStore } from '../../store/trackerStore';
import { AccountError, deleteAccount, signOut } from '../../sync/auth';
import { syncNow } from '../../sync/useCloudSync';
import styles from './account.module.css';
import { syncLabel } from './syncLabel';

/** The account block on the settings page. */
export function AccountSection() {
  const user = useAccountStore((state) => state.user);
  const phase = useAccountStore((state) => state.syncPhase);
  const lastSyncedAt = useAccountStore((state) => state.lastSyncedAt);
  const ownerId = useTrackerStore((state) => state.sync.ownerId);
  const pending = useTrackerStore((state) => hasPendingChanges(state.sync));
  const clearLocalData = useTrackerStore((state) => state.clearLocalData);
  const toast = useToastStore((state) => state.show);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!user) {
    return (
      <>
        <p className={styles.help}>
          {ownerId
            ? 'You have been signed out. Sign in again to keep this device in sync.'
            : 'Sign in to back up your skills and sessions and use them on your other devices.'}
        </p>
        <Link to="/sign-in" className={styles.buttonLink}>
          Sign in
        </Link>
      </>
    );
  }

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (caught) {
      toast(caught instanceof AccountError ? caught.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = () =>
    run(async () => {
      // Signing out empties this device, so get everything to the server first.
      await syncNow();
      const unsynced = hasPendingChanges(useTrackerStore.getState().sync);
      if (
        unsynced &&
        !window.confirm(
          'Some changes have not synced yet and will be lost if you sign out now. Sign out anyway?',
        )
      ) {
        return;
      }
      await signOut();
      clearLocalData();
      toast('Signed out');
    });

  const handleDelete = () =>
    run(async () => {
      await deleteAccount();
      clearLocalData();
      toast('Account deleted');
    });

  return (
    <>
      <p className={styles.help}>
        Signed in as <strong>{user.email}</strong>
      </p>
      <p className={styles.status} role="status">
        {syncLabel(phase, pending)}
        {phase === 'idle' && !pending && lastSyncedAt !== null && (
          <>
            {' '}
            at{' '}
            {new Date(lastSyncedAt).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </>
        )}
      </p>
      <div className={styles.actions}>
        <Button onClick={() => void run(syncNow)} disabled={busy || phase === 'syncing'}>
          Sync now
        </Button>
        <Button onClick={() => void handleSignOut()} disabled={busy}>
          Sign out
        </Button>
        {confirmingDelete ? (
          <Button variant="danger" onClick={() => void handleDelete()} disabled={busy}>
            Delete account and all its data
          </Button>
        ) : (
          <Button variant="danger" onClick={() => setConfirmingDelete(true)} disabled={busy}>
            Delete account
          </Button>
        )}
      </div>
      <p className={styles.footnote}>
        Signing out removes your data from this device. It stays in your account.
      </p>
    </>
  );
}
