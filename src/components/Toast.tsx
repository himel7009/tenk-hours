import { useEffect } from 'react';
import { useToastStore } from '../store/toastStore';
import styles from './Toast.module.css';

const VISIBLE_MS = 4000;

export function Toast() {
  const message = useToastStore((state) => state.message);
  const action = useToastStore((state) => state.action);
  const key = useToastStore((state) => state.key);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    // A toast with a button waits for an answer.
    if (message === null || action) return;
    const timeout = window.setTimeout(dismiss, VISIBLE_MS);
    return () => window.clearTimeout(timeout);
  }, [message, action, key, dismiss]);

  return (
    <div className={styles.region} role="status" aria-live="polite">
      {message !== null && (
        <div key={key} className={styles.toast}>
          <p>{message}</p>
          {action && (
            <>
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  dismiss();
                  action.run();
                }}
              >
                {action.label}
              </button>
              <button type="button" className={styles.close} onClick={dismiss} aria-label="Dismiss">
                ×
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
