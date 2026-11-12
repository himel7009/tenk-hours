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
  const stopTimer = useTrackerStore((state) => state.stopTimer);
  const discardTimer = useTrackerStore((state) => state.discardTimer);
  const toast = useToastStore((state) => state.show);

  const activeSkill: Skill | undefined = activeTimer
    ? skills.find((skill) => skill.id === activeTimer.skillId)
    : undefined;

  return {
    activeTimer,
    activeSkill,
    /** Starts a countdown of the given length, or a stopwatch if null. */
    start: (skillId: SkillId, durationMinutes: number | null) => {
      if (durationMinutes !== null) requestNotificationPermission();
      startTimer(skillId, durationMinutes);
    },
    stop: () => {
      const saved = stopTimer();
      toast(
        saved
          ? `Saved ${formatDuration(saved.minutes)} to ${activeSkill?.name ?? 'your skill'}`
          : 'Timer ran for under a minute, so nothing was saved',
      );
    },
    discard: () => {
      discardTimer();
      toast('Timer discarded');
    },
  };
}
