# Tenk

A 10,000-hours skill tracker. React 19 + TypeScript + Vite, Zustand for state,
CSS Modules for styling, Vitest for tests. Deployed to GitHub Pages at
https://himel7009.github.io/tenk-hours/ by `.github/workflows/deploy.yml` on
every push to `main`. Optional accounts and sync run on Supabase.

## Commands

- `npm run dev` starts the dev server
- `npm test` runs the unit tests
- `npm run lint` runs ESLint
- `npm run build` type-checks and builds to `dist/`
- `npm run format` formats with Prettier

Run lint, test and build before every commit. CI runs the same three and a
failure blocks the deploy.

## Layout and rules

- `src/domain/` is pure logic (dates, streaks, stats, milestones). No React, no
  storage. New measures go here first, with tests.
- `src/store/trackerStore.ts` is the single source of truth, persisted to
  localStorage. If its persisted shape changes, bump `STORAGE_VERSION` and add
  a `migrate` step so existing users keep their data.
- `src/sync/` holds the Supabase client, auth and the sync engine. Every store
  action that changes a skill or session must call `markPending`, or the
  change will never reach the server.
- `src/features/<name>/` holds one feature's components. Components never
  compute streaks or totals themselves; they use hooks in `features/progress/`.
- `supabase/migrations/` is the database schema. Never edit an applied
  migration; add a new file. Any new table needs row level security policies
  and a case in `supabase/tests/rls_test.sql`.
- Styling uses the tokens in `src/styles/tokens.css`. No new colours, fonts or
  UI libraries without asking.
- UI copy is plain sentence case. Buttons say what they do ("Save changes").

## Security

- Only `VITE_SUPABASE_URL` and the publishable key (`sb_publishable_...`) may
  appear in client code, env files or CI variables. Never use or ask for the
  Supabase secret key or the database password in this repo.
- Never commit `.env.local`.
- Access control lives in Postgres policies, not in the client.

## Remaining work for cloud sync

The cloud sync code is written and tested locally but not yet committed or
live. Work through these in order. Delete this section when all are done.

### Things you (Claude Code) can do now

1. Move the updated workflow into place:
   `mkdir -p .github/workflows && mv deploy-workflow.yml .github/workflows/deploy.yml`
2. Run `npm install`, then `npm run lint`, `npm test` and `npm run build`. All
   must pass (43 tests). Fix anything that fails before continuing.
3. Commit everything on `main` with the message
   "Add optional cloud sync with Supabase accounts" and push. This is safe
   before Supabase exists: without the two variables the site builds exactly
   as before, with no sign-in button.
4. Check the Actions run succeeds: `gh run watch`.

### Things only Himel can do (walk him through them one at a time)

These need his logins in a browser. Follow `docs/cloud-setup.md` and ask him
to confirm each step before moving on. Do not ask him to paste secrets into
the chat other than the project URL and publishable key.

5. Create a Supabase project and run
   `supabase/migrations/20261111000000_cloud_sync.sql` in the SQL editor, then
   `supabase/tests/rls_test.sql` (every output line should start with `ok:`).
6. In Supabase, set the Site URL and Redirect URLs to
   `https://himel7009.github.io/tenk-hours/` (plus `http://localhost:5173/`).
7. Create a Google OAuth client (Web application) and enable the Google
   provider in Supabase with its client ID and secret.

### Once he gives you the project URL and publishable key

8. Write them to `.env.local` (see `.env.example`) for local development.
9. Set them as GitHub repository variables so the deployed build picks them up:
   `gh variable set VITE_SUPABASE_URL --body "<url>"` and
   `gh variable set VITE_SUPABASE_PUBLISHABLE_KEY --body "<key>"`,
   then re-run the deploy: `gh workflow run deploy.yml`.

### Verify on the live site, with Himel

10. Create an account with email and password, confirm the email, sign in.
11. Sign in with Google.
12. Add a skill and log time, then sign in on a second browser or phone and
    check the same data appears. Edit on one, confirm it reaches the other
    within a minute.
13. Request a password reset and set a new password.
14. Sign out and confirm the device is empty and the data returns on sign-in.

Real Google login and real Supabase emails have not been tested yet; so far
they were only exercised against a stand-in auth server. If something fails
here, check the browser console and the Supabase Auth logs first.

### Before opening sign-up to the public

15. Configure a custom SMTP provider in Supabase (the built-in sender allows
    only a few emails an hour).
16. Publish the Google OAuth consent screen (it starts in Testing mode).
