import { formatDuration } from '../../domain/format';
import type { PomodoroPlan } from '../../domain/pomodoro';
import type { Skill, SkillId } from '../../domain/types';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import { requestNotificationPermission } from './alerts';

/** Timer actions with the user-facing confirmation each one produces. */
export function useTimer() {
  const activeTimer = useTrackerStore((state) => state.activeTimer);
  const skills = useTrackerStore((state) => state.skills);
  const startTimer = useTrackerStore((state) => state.startTimer);
  const pauseTimer = useTrackerStore((state) => state.pauseTimer);
  const resumeTimer = useTrackerStore((state) => state.resumeTimer);
  const stopTimer = useTrackerStore((state) => state.stopTimer);
  const discardTimer = useTrackerStore((state) => state.discardTimer);
  const startNextRound = useTrackerStore((state) => state.startNextRound);
  const toast = useToastStore((state) => state.show);

  const activeSkill: Skill | undefined = activeTimer
    ? skills.find((skill) => skill.id === activeTimer.skillId)
    : undefined;

  return {
    activeTimer,
    activeSkill,
    /** Paused by hand. A Pomodoro break is not a pause. */
    paused: activeTimer?.pausedAt != null && (activeTimer.pomodoro?.phase ?? 'focus') === 'focus',
    phase: activeTimer?.pomodoro?.phase ?? null,
    /**
     * Starts a countdown of the given length in seconds, or a stopwatch if
     * null. With a plan, the countdown is focus time split into rounds. The
     * note says what the session is about and is required by the forms.
     */
    start: (
      skillId: SkillId,
      durationSeconds: number | null,
      plan: PomodoroPlan | null,
      note: string,
    ) => {
      if (durationSeconds !== null) requestNotificationPermission();
      startTimer(skillId, durationSeconds, plan, note);
    },
    nextRound: startNextRound,
    pause: pauseTimer,
    resume: resumeTimer,
    stop: () => {
      const saved = stopTimer();
      toast(
        saved
          ? `Saved ${formatDuration(saved.minutes)} to ${activeSkill?.name ?? 'your skill'}`
          : 'Less than a minute was timed, so nothing was saved',
      );
    },
    discard: () => {
      discardTimer();
      toast('Timer discarded');
    },
  };
}
