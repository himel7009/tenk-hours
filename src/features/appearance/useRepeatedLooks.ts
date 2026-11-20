import { useMemo } from 'react';
import { planLookFixes } from '../../domain/appearance';
import { useTrackerStore } from '../../store/trackerStore';

/** How many items share an icon or colour with an older one. */
export function useRepeatedLooks(): number {
  const skills = useTrackerStore((state) => state.skills);
  const domains = useTrackerStore((state) => state.domains);
  const badHabits = useTrackerStore((state) => state.badHabits);
  const sections = useTrackerStore((state) => state.moneySections);
  return useMemo(
    () =>
      planLookFixes(
        [skills, domains, badHabits, sections],
        ['skill', 'domain', 'badHabit', 'section'],
      ).length,
    [skills, domains, badHabits, sections],
  );
}
