import { useEffect } from 'react';
import { useTrackerStore } from '../store/trackerStore';

/** Mirrors the theme setting onto <html data-theme>, which tokens.css reads. */
export function useApplyTheme(): void {
  const theme = useTrackerStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.dataset.theme = theme;
    }
  }, [theme]);
}
