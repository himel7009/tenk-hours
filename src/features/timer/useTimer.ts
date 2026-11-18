import { formatDuration } from '../../domain/format';
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
  const toast = useToastStore((state) => state.show);

  const activeSkill: Skill | undefined = activeTimer
    ? skills.find((skill) => skill.id === activeTimer.skillId)
    : undefined;

  return {
    activeTimer,
    activeSkill,
    paused: activeTimer?.pausedAt != null,
    /** Starts a countdown of the given length in seconds, or a stopwatch if null. */
    start: (skillId: SkillId, durationSeconds: number | null) => {
      if (durationSeconds !== null) requestNotificationPermission();
      startTimer(skillId, durationSeconds);
    },
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
