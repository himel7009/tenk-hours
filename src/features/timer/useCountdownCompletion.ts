import { useEffect } from 'react';
import { formatClock, formatDuration } from '../../domain/format';
import { useToastStore } from '../../store/toastStore';
import { buildSchedule, displayClockMs, nextPomodoroEvent } from '../../domain/pomodoro';
import { timerEndsAt } from '../../domain/timer';
import type { ActiveTimer } from '../../domain/types';
import { useTrackerStore } from '../../store/trackerStore';
import { notify, playChime } from './alerts';

/** setTimeout cannot wait longer than this many milliseconds. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/** When the timer next needs attention: its end, or a Pomodoro phase change. */
function nextEventAt(timer: ActiveTimer): number {
  return Math.min(timerEndsAt(timer), nextPomodoroEvent(timer));
}

function titleLabel(timer: ActiveTimer, clock: string): string {
  const phase = timer.pomodoro?.phase;
  if (phase === 'break') return `Break ${clock}`;
  if (phase === 'ready') return `Ready for round ${(timer.pomodoro?.round ?? 0) + 1}`;
  return timer.pausedAt === null ? clock : `Paused ${clock}`;
}

/** Plays the chime and, when the app is in the background, a notification. */
function announce(title: string, message: string) {
  useToastStore.getState().show(message);
  playChime();
  if (document.visibilityState !== 'visible') void notify(title, message);
}

/**
 * Mount once. Saves a countdown's session the moment it runs out, including
 * when the app is reopened after the countdown ended, moves Pomodoro sessions
 * between rounds and breaks, and shows the clock in the tab title while any
 * timer runs.
 */
export function useCountdownCompletion(): void {
  const activeTimer = useTrackerStore((state) => state.activeTimer);
  const skillName = useTrackerStore(
    (state) => state.skills.find((skill) => skill.id === activeTimer?.skillId)?.name,
  );

  useEffect(() => {
    if (!activeTimer) return;

    const finishIfDue = () => {
      const { advancePomodoro, stopTimer } = useTrackerStore.getState();
      const event = advancePomodoro();
      const current = useTrackerStore.getState().activeTimer;
      if (!current) return;

      if (event === 'break' || event === 'ready') {
        const state = current.pomodoro;
        const rounds =
          state && current.durationSeconds !== null
            ? buildSchedule(current.durationSeconds, state.plan)
            : [];
        const next = (state?.round ?? 0) + 1;
        if (event === 'break') {
          const minutes = Math.round((rounds[next - 2]?.breakSeconds ?? 0) / 60);
          announce(
            'Time for a break',
            `Round ${next - 1} of ${rounds.length} done. Take a ${minutes} minute break.`,
          );
        } else {
          announce(
            'Break over',
            `Break over. Start round ${next} of ${rounds.length} when you are ready.`,
          );
        }
        return;
      }

      if (event !== 'done' && Date.now() < timerEndsAt(current)) return;
      const saved = stopTimer();
      if (!saved) return;
      announce(
        'Timer finished',
        `${formatDuration(saved.minutes)} ${current.pomodoro ? 'of focus' : 'timer'} finished. Saved to ${skillName ?? 'your skill'}.`,
      );
    };

    finishIfDue();
    const untilEnd = Math.min(MAX_TIMEOUT_MS, Math.max(0, nextEventAt(activeTimer) - Date.now()));
    const timeout = window.setTimeout(finishIfDue, untilEnd);
    // Background tabs delay timers, so check again whenever the tab returns.
    document.addEventListener('visibilitychange', finishIfDue);

    const originalTitle = document.title;
    const showClock = () => {
      const clock = formatClock(displayClockMs(activeTimer, Date.now()));
      document.title = `${titleLabel(activeTimer, clock)} ${skillName ?? ''}`.trim();
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
