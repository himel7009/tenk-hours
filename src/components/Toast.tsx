import { useEffect } from 'react';
import { useToastStore } from '../store/toastStore';
import styles from './Toast.module.css';

const VISIBLE_MS = 4000;

export function Toast() {
  const message = useToastStore((state) => state.message);
  const key = useToastStore((state) => state.key);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    if (message === null) return;
    const timeout = window.setTimeout(dismiss, VISIBLE_MS);
    return () => window.clearTimeout(timeout);
  }, [message, key, dismiss]);

  return (
    <div className={styles.region} role="status" aria-live="polite">
      {message !== null && (
        <p key={key} className={styles.toast}>
          {message}
        </p>
      )}
    </div>
  );
}
