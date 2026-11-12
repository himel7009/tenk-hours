import { useEffect } from 'react';
import { formatClock, formatDuration } from '../../domain/format';
import { useToastStore } from '../../store/toastStore';
import { timerEndsAt, useTrackerStore } from '../../store/trackerStore';
import { notify, playChime } from './alerts';
import { clockMs } from './clockMs';

/** setTimeout cannot wait longer than this many milliseconds. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Mount once. Saves a countdown's session the moment it runs out, including
 * when the app is reopened after the countdown ended, and shows the clock in
 * the tab title while any timer runs.
 */
export function useCountdownCompletion(): void {
  const activeTimer = useTrackerStore((state) => state.activeTimer);
  const skillName = useTrackerStore(
    (state) => state.skills.find((skill) => skill.id === activeTimer?.skillId)?.name,
  );

  useEffect(() => {
    if (!activeTimer) return;

    const finishIfDue = () => {
      const { activeTimer: current, stopTimer } = useTrackerStore.getState();
      if (!current || Date.now() < timerEndsAt(current)) return;

      const saved = stopTimer();
      if (!saved) return;
      const message = `${formatDuration(saved.minutes)} timer finished. Saved to ${skillName ?? 'your skill'}.`;
      useToastStore.getState().show(message);
      playChime();
      if (document.visibilityState !== 'visible') void notify('Timer finished', message);
    };

    finishIfDue();
    const untilEnd = Math.min(MAX_TIMEOUT_MS, Math.max(0, timerEndsAt(activeTimer) - Date.now()));
    const timeout = window.setTimeout(finishIfDue, untilEnd);
    // Background tabs delay timers, so check again whenever the tab returns.
    document.addEventListener('visibilitychange', finishIfDue);

    const originalTitle = document.title;
    const showClock = () => {
      document.title = `${formatClock(clockMs(activeTimer, Date.now()))} ${skillName ?? ''}`.trim();
    };
    showClock();
    const tick = window.setInterval(showClock, 1000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', finishIfDue);
      document.title = originalTitle;
    };
  }, [activeTimer, skillName]);
}
