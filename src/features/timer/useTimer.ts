import { formatDuration } from '../../domain/format';
import type { Skill } from '../../domain/types';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';

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
    start: startTimer,
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
