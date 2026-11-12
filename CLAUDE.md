# Tenk

A 10,000-hours skill tracker with daily habits. React 19 + TypeScript + Vite, Zustand for state,
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

## Skills and habits

A row in `skills` (type `Skill`) is either a skill or a habit, told apart by
`kind`. Both share sessions, timers, streaks and sync. The name `Skill` is
historical; do not rename the table or type without a data migration plan.

- Streaks are per skill or habit, never app-wide. A day counts only when that
  day's minutes reach the item's `dailyGoalMinutes` (default 60).
- Timers are countdowns by default (`ActiveTimer.durationMinutes`), saved
  automatically when they end; `null` means an open-ended stopwatch.

## Deploying changes that touch the database

The live site talks to a real Supabase project with real user data. When a
change adds a migration, Himel must run the new SQL file in the Supabase SQL
editor **before** the code is pushed to `main`. If the code goes first, sync
fails for signed-in users until the migration is applied (their data stays
safe on the device and syncs afterwards).

## Before opening sign-up to the public

- Configure a custom SMTP provider in Supabase (the built-in sender allows
  only a few emails an hour).
- Publish the Google OAuth consent screen (it starts in Testing mode).
