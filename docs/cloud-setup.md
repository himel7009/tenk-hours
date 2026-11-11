# Cloud sync setup

Tenk uses [Supabase](https://supabase.com) for accounts and sync. This is a
one-time setup. The free tier is enough.

## 1. Create the Supabase project

1. Sign up at supabase.com and create a new project. Pick a region close to
   your users and save the database password somewhere safe.
2. Open **SQL Editor**, paste the contents of
   [`supabase/migrations/20261111000000_cloud_sync.sql`](../supabase/migrations/20261111000000_cloud_sync.sql)
   and run it. This creates the `skills` and `sessions` tables, the row level
   security policies and the `delete_account` function.
3. Optional but recommended: run
   [`supabase/tests/rls_test.sql`](../supabase/tests/rls_test.sql) the same way.
   It checks that one user cannot read or change another user's data, then
   rolls itself back. Every line of output should start with `ok:`.

## 2. Configure sign-in

Under **Authentication → URL Configuration**:

- **Site URL**: `https://himel7009.github.io/tenk-hours/`
- **Redirect URLs**: add `https://himel7009.github.io/tenk-hours/` and, for
  local development, `http://localhost:5173/`

Email and password sign-in is on by default. Under **Authentication → Sign In /
Providers → Email**, keep **Confirm email** on and set the minimum password
length to 8 to match the app.

### Google sign-in

1. In the [Google Cloud Console](https://console.cloud.google.com/), create a
   project, then configure the OAuth consent screen (External).
2. Create an **OAuth client ID** of type **Web application**.
   - Authorised JavaScript origins: `https://himel7009.github.io`
   - Authorised redirect URI: the callback URL Supabase shows under
     **Authentication → Sign In / Providers → Google**. It looks like
     `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Copy the client ID and client secret into the Google provider settings in
   Supabase and enable the provider.

While the consent screen is in "Testing", only the test users you list can sign
in with Google. Publish it when you are ready for everyone.

## 3. Give the app its keys

From **Project Settings → API Keys** you need the **Project URL** and the
**publishable key** (`sb_publishable_...`). The publishable key is designed to
be public. Never use the secret key in this app.

**Local development**: copy `.env.example` to `.env.local` and fill in both
values, then restart `npm run dev`.

**GitHub Pages**: in the repository, open **Settings → Secrets and variables →
Actions → Variables** and add two repository variables:

| Name                            | Value                |
| ------------------------------- | -------------------- |
| `VITE_SUPABASE_URL`             | your project URL     |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | your publishable key |

The build step in `.github/workflows/deploy.yml` passes them to Vite. Push to
`main`, or re-run the workflow, and the deployed site shows **Sign in**.

## 4. Before real users arrive

- **Email sending**: Supabase's built-in email service is rate limited to a few
  messages an hour and is meant for testing. Add your own SMTP provider under
  **Authentication → Emails** before opening sign-up to the public.
- **Abuse protection**: turn on CAPTCHA under **Authentication → Attack
  Protection** if you see automated sign-ups.
- **Backups**: the free tier has no point-in-time recovery. Users can still
  download their own backup from Settings.

## How sync works

- Every change is written to the device first and added to a pending list.
- A sync pushes the pending list, then pulls every row whose `updated_at` is
  newer than the device's cursor. `updated_at` is set by a database trigger, so
  clients cannot forge it.
- Deletes set `deleted_at` instead of removing the row, so other devices learn
  about them.
- If two devices edit the same skill or session, the one that syncs last wins.
- Signing out empties the device after a final sync; the data stays in the
  account. Signing in on a device that has guest data uploads that data to the
  account.

Known limits: password reset and email confirmation links must be opened in
the same browser that requested them, and changes made on another device show
up within a minute or when the tab regains focus rather than instantly.
