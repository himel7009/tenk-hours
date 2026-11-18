import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { PIN_MAX_LENGTH, verifyPin } from '../../domain/pin';
import { useAccountStore } from '../../store/accountStore';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import { useNow } from '../progress/useNow';
import { useLockSession } from './lockSession';
import styles from './LockScreen.module.css';

/** Stands in for the bad habits until the PIN is entered. */
export function LockScreen() {
  const lock = useTrackerStore((state) => state.badHabitLock);
  const badHabits = useTrackerStore((state) => state.badHabits);
  const deleteBadHabit = useTrackerStore((state) => state.deleteBadHabit);
  const setBadHabitLock = useTrackerStore((state) => state.setBadHabitLock);
  const signedIn = useAccountStore((state) => state.user !== null);
  const { failures, retryAt, unlock, recordFailure } = useLockSession();
  const toast = useToastStore((state) => state.show);
  const now = useNow(1000);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const waitSeconds = Math.max(0, Math.ceil((retryAt - now) / 1000));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!lock || waitSeconds > 0 || pin === '') return;
    setChecking(true);
    const correct = await verifyPin(pin, lock);
    setChecking(false);
    setPin('');
    if (correct) {
      setError(null);
      unlock();
    } else {
      recordFailure();
      setError('Wrong PIN.');
    }
  };

  const resetOnThisDevice = () => {
    for (const habit of badHabits) deleteBadHabit(habit.id);
    setBadHabitLock(null);
    toast('Lock removed and bad habits cleared on this device');
  };

  return (
    <div className={styles.screen}>
      <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
        <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
        <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
      </svg>
      <h2 className={styles.title}>Bad habits are locked</h2>
      <p className={styles.lede}>Enter your PIN to see and update them.</p>

      <form onSubmit={(event) => void handleSubmit(event)} className={styles.form}>
        <label htmlFor="unlock-pin" className="visually-hidden">
          PIN
        </label>
        <input
          id="unlock-pin"
          className={styles.pin}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={PIN_MAX_LENGTH}
          placeholder="PIN"
          autoFocus
          disabled={waitSeconds > 0}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={checking || waitSeconds > 0 || pin === ''}
        >
          Unlock
        </Button>
      </form>

      <p className={styles.status} role="alert">
        {waitSeconds > 0
          ? `Too many wrong PINs. Try again in ${waitSeconds} seconds.`
          : error && failures > 0
            ? `${error} ${failures >= 3 ? 'Take your time.' : 'Try again.'}`
            : ''}
      </p>

      <button
        type="button"
        className={styles.help}
        onClick={() => setShowHelp(!showHelp)}
        aria-expanded={showHelp}
      >
        Forgot your PIN?
      </button>
      {showHelp &&
        (signedIn ? (
          <p className={styles.helpText}>
            Sign out from Settings and sign back in on this device. That removes the lock, and your
            bad habits come back from your account.
          </p>
        ) : (
          <div className={styles.helpText}>
            <p>
              Without an account, the only way back in is to remove the lock together with the bad
              habits stored on this device.
            </p>
            {confirmingReset ? (
              <Button size="sm" variant="danger" onClick={resetOnThisDevice}>
                Delete {badHabits.length} bad habit{badHabits.length === 1 ? '' : 's'} and remove
                the lock
              </Button>
            ) : (
              <Button size="sm" variant="quiet" onClick={() => setConfirmingReset(true)}>
                Remove the lock
              </Button>
            )}
          </div>
        ))}
    </div>
  );
}
