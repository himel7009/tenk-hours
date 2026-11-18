import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input } from '../../components/Field';
import {
  createPinLock,
  isValidPin,
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  verifyPin,
} from '../../domain/pin';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import formStyles from '../skills/SkillFormDialog.module.css';
import { useLockSession } from './lockSession';

export type PinDialogMode = 'set' | 'change' | 'remove';

const TITLES: Record<PinDialogMode, string> = {
  set: 'Lock bad habits with a PIN',
  change: 'Change PIN',
  remove: 'Remove PIN',
};

const SUBMIT: Record<PinDialogMode, string> = {
  set: 'Set PIN',
  change: 'Change PIN',
  remove: 'Remove PIN',
};

interface PinDialogProps {
  mode: PinDialogMode;
  onClose: () => void;
}

/** A PIN field: digits only, hidden, and never offered to password managers. */
function PinInput(props: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <Input
      id={props.id}
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={PIN_MAX_LENGTH}
      autoFocus={props.autoFocus}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value.replace(/\D/g, ''))}
    />
  );
}

export function PinDialog({ mode, onClose }: PinDialogProps) {
  const lock = useTrackerStore((state) => state.badHabitLock);
  const setBadHabitLock = useTrackerStore((state) => state.setBadHabitLock);
  const unlock = useLockSession((state) => state.unlock);
  const relock = useLockSession((state) => state.lock);
  const toast = useToastStore((state) => state.show);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mode !== 'set') {
      if (!lock || !(await verifyPin(current, lock))) {
        setError('That is not your current PIN.');
        return;
      }
    }
    if (mode !== 'remove') {
      if (!isValidPin(next)) {
        setError(`Use ${PIN_MIN_LENGTH} to ${PIN_MAX_LENGTH} digits.`);
        return;
      }
      if (next !== confirm) {
        setError('The two PINs do not match.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'remove') {
        setBadHabitLock(null);
        toast('PIN removed. Bad habits are no longer locked on this device.');
      } else {
        setBadHabitLock(await createPinLock(next));
        // Setting a PIN while looking at the bad habits keeps them open;
        // they lock again on leaving the tab.
        if (mode === 'set') unlock();
        else relock();
        toast(mode === 'set' ? 'PIN set. Bad habits are locked on this device.' : 'PIN changed');
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={TITLES[mode]} onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)} className={formStyles.form} noValidate>
        {mode === 'set' && (
          <p className={formStyles.hint}>
            The PIN hides your bad habits on this device until it is entered. Each device has its
            own PIN.
          </p>
        )}
        {mode !== 'set' && (
          <Field label="Current PIN">
            {(id) => <PinInput id={id} value={current} onChange={setCurrent} autoFocus />}
          </Field>
        )}
        {mode !== 'remove' && (
          <>
            <Field label="New PIN" hint={`${PIN_MIN_LENGTH} to ${PIN_MAX_LENGTH} digits.`}>
              {(id) => (
                <PinInput id={id} value={next} onChange={setNext} autoFocus={mode === 'set'} />
              )}
            </Field>
            <Field label="New PIN again">
              {(id) => <PinInput id={id} value={confirm} onChange={setConfirm} />}
            </Field>
          </>
        )}

        {error && (
          <p className={formStyles.error} role="alert">
            {error}
          </p>
        )}

        <div className={formStyles.actions}>
          <span className={formStyles.spacer} />
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={mode === 'remove' ? 'danger' : 'primary'} disabled={busy}>
            {SUBMIT[mode]}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
