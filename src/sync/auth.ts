import type { AuthError } from '@supabase/supabase-js';
import { authRedirectUrl, supabase } from './supabaseClient';

export const MIN_PASSWORD_LENGTH = 8;

/** An auth failure with a message that can be shown to the user as-is. */
export class AccountError extends Error {}

function client() {
  if (!supabase) throw new AccountError('Accounts are not set up for this site.');
  return supabase;
}

function toAccountError(error: AuthError): AccountError {
  switch (error.code) {
    case 'invalid_credentials':
      return new AccountError('Email or password is incorrect.');
    case 'email_not_confirmed':
      return new AccountError('Confirm your email first. The link is in your inbox.');
    case 'weak_password':
      return new AccountError('Choose a stronger password.');
    case 'same_password':
      return new AccountError('Choose a password you have not used here before.');
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return new AccountError('Too many attempts. Wait a minute and try again.');
    default:
      return new AccountError(error.message);
  }
}

/** Leaves the page for Google and comes back signed in. */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await client().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authRedirectUrl() },
  });
  if (error) throw toAccountError(error);
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw toAccountError(error);
}

/** Resolves to true if signed in at once, false if the email must be confirmed first. */
export async function signUp(email: string, password: string): Promise<boolean> {
  const { data, error } = await client().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: authRedirectUrl() },
  });
  if (error) throw toAccountError(error);
  return data.session !== null;
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await client().auth.resetPasswordForEmail(email, {
    redirectTo: authRedirectUrl(),
  });
  if (error) throw toAccountError(error);
}

export async function setNewPassword(password: string): Promise<void> {
  const { error } = await client().auth.updateUser({ password });
  if (error) throw toAccountError(error);
}

/** Ends the session on this device only. */
export async function signOut(): Promise<void> {
  const { error } = await client().auth.signOut({ scope: 'local' });
  if (error) throw toAccountError(error);
}

/** Permanently deletes the account and everything stored for it. */
export async function deleteAccount(): Promise<void> {
  const { error } = await client().rpc('delete_account');
  if (error) throw new AccountError('The account could not be deleted. Try again.');
  await client().auth.signOut({ scope: 'local' });
}
