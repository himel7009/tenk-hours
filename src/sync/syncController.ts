import type { SyncPhase } from '../store/accountStore';
import { syncOnce, type SyncableStore } from './syncEngine';
import type { RemoteStore } from './types';

export interface SyncController {
  /** Asks for a sync, optionally after a delay. Requests are coalesced. */
  request: (delayMs?: number) => void;
  /** Resolves when no sync is running or queued. */
  settle: () => Promise<void>;
  dispose: () => void;
}

/**
 * Runs at most one sync at a time. A request that arrives while one is
 * running triggers exactly one follow-up run, however many requests there were.
 */
export function createSyncController(
  remote: RemoteStore,
  store: SyncableStore,
  onPhase: (phase: SyncPhase) => void,
): SyncController {
  let running: Promise<void> | null = null;
  let queued = false;
  let disposed = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  async function run(): Promise<void> {
    do {
      queued = false;
      onPhase('syncing');
      try {
        await syncOnce(remote, store);
        if (!disposed) onPhase('idle');
      } catch (error) {
        if (disposed) return;
        console.error('Sync failed', error);
        onPhase(navigator.onLine ? 'error' : 'offline');
      }
    } while (queued && !disposed);
  }

  function start() {
    if (disposed) return;
    if (running) {
      queued = true;
      return;
    }
    running = run().finally(() => {
      running = null;
    });
  }

  return {
    request(delayMs = 0) {
      clearTimeout(timeout);
      if (delayMs === 0) start();
      else timeout = setTimeout(start, delayMs);
    },
    async settle() {
      while (running) await running;
    },
    dispose() {
      disposed = true;
      clearTimeout(timeout);
    },
  };
}
