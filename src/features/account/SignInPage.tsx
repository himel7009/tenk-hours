import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { Button } from '../../components/Button';
import { Field, Input } from '../../components/Field';
import { useAccountStore } from '../../store/accountStore';
import {
  AccountError,
  MIN_PASSWORD_LENGTH,
  sendPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signUp,
} from '../../sync/auth';
import { isCloudEnabled } from '../../sync/supabaseClient';
import styles from './account.module.css';

type Mode = 'sign-in' | 'sign-up' | 'reset';

const COPY: Record<Mode, { title: string; submit: string }> = {
  'sign-in': { title: 'Sign in to sync', submit: 'Sign in' },
  'sign-up': { title: 'Create an account', submit: 'Create account' },
  reset: { title: 'Reset your password', submit: 'Send reset link' },
};

export function SignInPage() {
  const user = useAccountStore((state) => state.user);
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  if (!isCloudEnabled) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Accounts are not set up</h1>
        <p className={styles.lede}>
          This copy of Tenk stores everything on your device.{' '}
          <Link to="/">Back to your skills</Link>
        </p>
      </div>
    );
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const attempt = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (caught) {
      setError(
        caught instanceof AccountError ? caught.message : 'Something went wrong. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!address.includes('@')) {
      setError('Enter your email address.');
      return;
    }
    if (mode === 'sign-up' && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    void attempt(async () => {
      if (mode === 'sign-in') {
        await signInWithPassword(address, password);
      } else if (mode === 'sign-up') {
        const signedIn = await signUp(address, password);
        if (!signedIn) {
          setNotice('Check your inbox and confirm your email to finish creating the account.');
        }
      } else {
        await sendPasswordReset(address);
        setNotice('If an account exists for that address, a reset link is on its way.');
      }
    });
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{COPY[mode].title}</h1>
      <p className={styles.lede}>
        {mode === 'reset'
          ? 'Enter the email you signed up with and we will send you a link to set a new password.'
          : 'Skills and sessions already on this device are saved to your account and kept in step across your devices.'}
      </p>

      {mode !== 'reset' && (
        <>
          <Button
            className={styles.wide}
            disabled={busy}
            onClick={() => void attempt(signInWithGoogle)}
          >
            Continue with Google
          </Button>
          <p className={styles.divider}>or use your email</p>
        </>
      )}

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <Field label="Email">
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>

        {mode !== 'reset' && (
          <Field
            label="Password"
            hint={mode === 'sign-up' ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
          >
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}

        <Button type="submit" variant="primary" className={styles.wide} disabled={busy}>
          {COPY[mode].submit}
        </Button>
      </form>

      <div className={styles.switches}>
        {mode === 'sign-in' ? (
          <>
            <button type="button" className={styles.link} onClick={() => switchMode('sign-up')}>
              Create an account
            </button>
            <button type="button" className={styles.link} onClick={() => switchMode('reset')}>
              Forgot your password?
            </button>
          </>
        ) : (
          <button type="button" className={styles.link} onClick={() => switchMode('sign-in')}>
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}
