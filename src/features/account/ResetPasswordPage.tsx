import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Field, Input } from '../../components/Field';
import { useAccountStore } from '../../store/accountStore';
import { useToastStore } from '../../store/toastStore';
import { AccountError, MIN_PASSWORD_LENGTH, setNewPassword } from '../../sync/auth';
import styles from './account.module.css';

/** Where a password reset email lands. The link has already signed the user in. */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const ready = useAccountStore((state) => state.ready);
  const user = useAccountStore((state) => state.user);
  const setPasswordRecovery = useAccountStore((state) => state.setPasswordRecovery);
  const toast = useToastStore((state) => state.show);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ready && !user) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>This reset link has expired</h1>
        <p className={styles.lede}>
          Reset links work once, in the browser that requested them.{' '}
          <Link to="/sign-in">Request a new one</Link>
        </p>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    try {
      await setNewPassword(password);
      setPasswordRecovery(false);
      toast('Password updated');
      void navigate('/', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof AccountError ? caught.message : 'Something went wrong. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Set a new password</h1>
      <form onSubmit={(event) => void handleSubmit(event)} className={styles.form} noValidate>
        <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" className={styles.wide} disabled={busy}>
          Save new password
        </Button>
      </form>
    </div>
  );
}
