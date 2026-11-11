import type { SyncPhase } from '../../store/accountStore';

/** One line describing where the user's data stands. */
export function syncLabel(phase: SyncPhase, hasPending: boolean): string {
  switch (phase) {
    case 'syncing':
      return 'Syncing';
    case 'offline':
      return 'Offline. Changes are saved on this device and will sync later.';
    case 'error':
      return 'Sync is not working right now. Changes are saved on this device.';
    case 'idle':
      return hasPending ? 'Changes waiting to sync' : 'Everything is synced';
  }
}
