import { useMemo } from 'react';
import { useTrackerStore } from '../../store/trackerStore';
import { customColorCss } from './customColors';

/** Styles for the custom colours in use. Mounted once, at the app root. */
export function CustomColorStyles() {
  const skills = useTrackerStore((state) => state.skills);
  const domains = useTrackerStore((state) => state.domains);
  const badHabits = useTrackerStore((state) => state.badHabits);
  const sections = useTrackerStore((state) => state.moneySections);
  const css = useMemo(
    () =>
      customColorCss([...skills, ...domains, ...badHabits, ...sections].map((item) => item.color)),
    [skills, domains, badHabits, sections],
  );
  return css === '' ? null : <style>{css}</style>;
}
