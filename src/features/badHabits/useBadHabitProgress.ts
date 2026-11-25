import { useMemo } from 'react';
import {
  buildBadHabitReport,
  summarizeBadHabit,
  type BadHabit,
  type BadHabitId,
  type BadHabitProgress,
  type BadHabitReport,
} from '../../domain/badHabits';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from '../progress/useNow';

export function useBadHabitProgress(habitId: BadHabitId): BadHabitProgress {
  const checkIns = useTrackerStore((state) => state.checkIns);
  const today = useToday();
  return useMemo(
    () =>
      summarizeBadHabit(
        checkIns.filter((checkIn) => checkIn.habitId === habitId),
        today,
      ),
    [checkIns, habitId, today],
  );
}

/** How many bad habits still have no answer for today. */
export function useUnansweredBadHabits(): number {
  const badHabits = useTrackerStore((state) => state.badHabits);
  const checkIns = useTrackerStore((state) => state.checkIns);
  const today = useToday();
  return useMemo(() => {
    const answered = new Set(checkIns.filter((c) => c.day === today).map((c) => c.habitId));
    return badHabits.filter((habit) => !answered.has(habit.id)).length;
  }, [badHabits, checkIns, today]);
}

/** The full report for a bad habit's page. */
export function useBadHabitReport(habit: BadHabit): BadHabitReport {
  const checkIns = useTrackerStore((state) => state.checkIns);
  const today = useToday();
  return useMemo(
    () =>
      buildBadHabitReport(
        habit,
        checkIns.filter((checkIn) => checkIn.habitId === habit.id),
        today,
      ),
    [checkIns, habit, today],
  );
}
