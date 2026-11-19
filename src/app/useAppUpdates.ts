import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { useToastStore } from '../store/toastStore';

/** How often an open app looks for a newer version. */
const CHECK_INTERVAL_MS = 30 * 60_000;

/**
 * Mount once. An installed app, or a tab left open, keeps running the
 * version it loaded. This looks for a newer one now and then, and offers a
 * reload when one is ready rather than reloading in the middle of an edit.
 */
export function useAppUpdates(): void {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    let registration: ServiceWorkerRegistration | undefined;
    const check = () => {
      if (navigator.onLine && document.visibilityState === 'visible') void registration?.update();
    };

    const updateApp = registerSW({
      immediate: true,
      onRegisteredSW(_url, found) {
        registration = found;
      },
      onNeedRefresh() {
        useToastStore.getState().show('A new version of Tenk is ready.', {
          label: 'Reload',
          // Running timers and unsynced changes are kept in storage.
          run: () => void updateApp(true),
        });
      },
    });

    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
}
