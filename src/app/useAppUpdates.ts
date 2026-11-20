import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { useToastStore } from '../store/toastStore';

/** How often an open app looks for a newer version. */
const CHECK_INTERVAL_MS = 30 * 60_000;

/**
 * Mount once. An installed app, or a tab left open, keeps running the
 * version it loaded. This looks for a newer one now and then. Once one has
 * taken over it offers a reload rather than reloading in the middle of an edit.
 */
export function useAppUpdates(): void {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    let registration: ServiceWorkerRegistration | undefined;
    const check = () => {
      if (navigator.onLine && document.visibilityState === 'visible') void registration?.update();
    };

    registerSW({
      immediate: true,
      onRegisteredSW(_url, found) {
        registration = found;
      },
      // The new version is already installed and in charge; this page still
      // runs the old code until it reloads. Running timers and unsynced
      // changes are kept in storage, so reloading loses nothing.
      onNeedReload() {
        useToastStore.getState().show('A new version of Tenk is ready.', {
          label: 'Reload',
          run: () => window.location.reload(),
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
