import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Null when the build has no Supabase project configured. The app then runs
 * on-device only and hides everything account related.
 *
 * The publishable key is meant to ship to browsers. It grants nothing by
 * itself: access is decided by the row level security policies in
 * supabase/migrations.
 */
export const supabase: SupabaseClient | null =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: {
          // PKCE returns a one-time ?code= instead of tokens in the URL hash,
          // which is safer and does not collide with hash routing.
          flowType: 'pkce',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

export const isCloudEnabled = supabase !== null;

/** Where auth emails and OAuth send the browser back to: the app's root. */
export function authRedirectUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}
