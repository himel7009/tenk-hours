import { useEffect } from 'react';
import { useTrackerStore } from '../store/trackerStore';

/**
 * Mirrors the theme and surface settings onto <html data-theme> and
 * <html data-surface>, which tokens.css and glass.css read.
 */
export function useApplyTheme(): void {
  const theme = useTrackerStore((state) => state.theme);
  const surface = useTrackerStore((state) => state.surface);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.dataset.theme = theme;
    }
  }, [theme]);

  // Glass or solid panels, read by glass.css.
  useEffect(() => {
    document.documentElement.dataset.surface = surface;
  }, [surface]);
}
