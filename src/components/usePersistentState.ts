import { useEffect, useState } from 'react';

/**
 * useState that remembers its value in this browser, for small view settings
 * such as the open tab. Storage can be unavailable (private windows, blocked
 * site data), in which case it quietly behaves like plain useState.
 */
export function usePersistentState<T extends string | boolean>(
  key: string,
  initial: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {
      // Fall through to the initial value.
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Not saved; the view simply resets next time.
    }
  }, [key, value]);

  return [value, setValue];
}
