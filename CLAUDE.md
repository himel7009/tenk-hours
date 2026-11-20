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

A row in `skills` (type `Skill`) is a skill, a habit or a project, told apart
by `kind`. All three share sessions, timers and sync. A project adds up time
with no target; its unused `targetHours` is kept so it can switch back to a
skill. Skills and projects can join a domain; habits cannot (`canJoinDomain`).
The name `Skill` is historical; do not rename the table or type without a data
migration plan.

- `keepStreak` makes the streak optional per tracker. Skills and habits always
  have a daily goal (`hasDailyGoal(skill)`); a project has one only while it
  keeps a streak. With the streak off, nothing shows or counts a streak
  (`keepsStreak`), but hours, goals and the activity map stay.
- `routineDays` (weekdays, 0 = Sunday, empty = every day, `domain/routine.ts`)
  plans the week. A skill in a domain follows the domain's `routineDays`
  (`routineOf`), never its own. A day off the routine neither counts nor breaks
  a streak (`computeStreak`'s `isDayOff`); time put in on a day off counts.
  Today's goals, a domain's daily plan and the report's goal days include only
  planned days. Changing a routine reinterprets past days too.
- Streaks are per tracker, never app-wide. A day counts only when that
  day's minutes reach the item's `dailyGoalMinutes` (default 60).
- Timers are countdowns by default (`ActiveTimer.durationSeconds`), saved
  automatically when they end; `null` means an open-ended stopwatch. Timers
  can be paused (`pausedAt`, `pausedMs`); paused time never counts. All timer
  maths lives in `domain/timer.ts`. Sessions are stored in whole minutes.
- Pomodoro (`ActiveTimer.pomodoro`, `domain/pomodoro.ts`) splits a countdown's
  focus time into rounds with breaks (`buildSchedule`). A break is the timer
  paused at the exact end of the round, so breaks never count; after a break
  the session waits in `ready` until the user starts the next round. The
  schedule is derived from `durationSeconds` and the plan, never stored. The
  per-browser choice of plan is `usePomodoroPlan`. Stopwatches never get
  rounds.

## Domains

A `Domain` (table `domains`) groups skills, for example AI holding machine
learning and deep learning. A skill has at most one domain (`Skill.domainId`,
nullable); habits never have one.

- A domain stores no progress. `summarizeDomain` derives its hours (the sum
  of its skills and projects) and its streak (a day counts when any one of
  its skills reached that skill's own daily goal; projects never count).
- A domain's daily plan (`DomainProgress.plan`) is the sum of its skills'
  daily goals. Today's covered time counts each skill only up to its own goal.
- Deleting a domain keeps its skills and sets their `domainId` to null.
- Push order matters: domains, then skills, then sessions.

## Bad habits

`BadHabit` (table `bad_habits`) is something to stay away from, tracked by a
daily `CheckIn` (table `bad_habit_checkins`): `clean` or `slipped`, at most one
per habit per day. Logic lives in `domain/badHabits.ts`.

- A check-in's id is derived from habit and day (`checkInId`), so two devices
  answering the same day write the same row and the later answer wins. Never
  give a check-in a random id.
- The streak is clean days in a row; a slip or a day with no answer ends it.
- Both tables share one sync cursor (`sync.badHabitCursor`).
- An optional PIN (`badHabitLock`, `domain/pin.ts`) hides them per device. It
  is stored only as a salted PBKDF2 hash, never synced, and cleared on sign
  out. Unlocked state lives in memory (`lockSession.ts`) and is dropped on
  leaving the tab or page, on the app going to the background, and on reload.
  It is a privacy screen, not encryption: backups and storage still hold the
  data.

## Home dashboard

`features/dashboard/` is the home page. Wide screens get two panes: a sticky
overview rail (Today card, the week from the routine, day and year progress
from `domain/timeProgress.ts`, the 7-day chart) and the trackers in tabs
(`TrackerTabs`: today, domains, skills, projects, habits, bad habits). The
Today tab (`TodayTab`) shows the to-do list, then every project planned
today (wherever it sits), then the planned domains without their projects
(`hideProjects`); a domain holding only projects is left out. The Projects tab
lists every project, tagged with its domain (`SkillCard`'s `showDomain`).
New trackers, projects included, start with `keepStreak` on.
Below 62rem the rail dissolves with `display: contents` so the tabs come
straight after the Today card. The open tab and each domain's
collapsed state are remembered per browser (`usePersistentState`). All
figures come from `summarizeDashboard`.

## Activity calendar

`ActivityCalendar` (`features/progress/`, logic in `domain/activity.ts`) is the
GitHub-style year of days: week columns, Sunday on top, five shades. With a
daily goal the shades are fixed fractions of it; without one they are
quartiles of the days shown. It is on the home page (all trackers combined
with `combineByDay`), on each domain (`DomainProgress.byDay`) and on each
tracker's page. It is separate from the 10,000-hour grid (`HourField`).

## To-dos

`Todo` (table `todos`, `domain/todos.ts`) is a plain checklist item: a title,
`done` and `doneAt`. No dates or history; "Clear done" soft-deletes done items.
It has its own sync cursor (`sync.todoCursor`) and is in backups.

## Money

`features/money/` is the Money page (`/money`), logic in `domain/money.ts`.
`MoneySection` (table `money_sections`) is a pot with its own budget;
`MoneyEntry` (table `money_entries`) is one line: `spend`, `add` (into the
budget) or `move` (to `toSectionId`, not spending). Amounts are positive whole
paisa (100 to a taka); `formatTaka` shows them. Both tables share one sync
cursor (`sync.moneyCursor`) and are in backups and live updates.

- A section's month (`summarizeMoneyMonth`): budget is what was carried in
  (only with `carryOver`) plus adds and moves in, less moves out; remaining is
  budget less spending. Nothing about balances is stored.
- Tags (transport, groceries...) come from words in the note (`tagOf`) and are
  never stored, so improving the word lists improves every past report.
- `domain/moneyImport.ts` reads a monthly expense sheet saved as CSV. Imported
  lines get stable ids (`stableUuid`), so importing a month again replaces it.
  Never commit a real sheet: tests use made-up data.
- The bad habits PIN (`badHabitLock`) also hides money (`usePrivacyLocked`).
  Deleting a section deletes its entries and any moves into it.

## Report

`features/report/` is the Report page (`/report`): a week (Monday to Sunday)
or calendar month, from `domain/report.ts`. `buildReport` derives everything
from sessions and check-ins; nothing is stored. While a period is still
running it is compared with the same number of days of the one before, so a
Thursday is set against last Thursday. Daily goals count only from the day a
tracker was created. Bad habits stay hidden while the PIN lock is on. The Library card
shows where each book and course stands now (`summarizeLibrary`), not
progress made in the period, since the library keeps no history.

## Library

`LibraryItem` (table `library_items`) is a book or course with progress in
chapters, pages or lessons, a free-text bookmark and notes. Its status is
`planned` (saved for later), `active`, `paused` or `done`. It is independent
of skills and sessions and has its own sync cursor (`sync.libraryCursor`), as
domains do (`sync.domainCursor`).

- `url` is the only user-supplied value rendered as a link. It must pass
  `isWebUrl` (http or https only) wherever it enters the app: the form, backup
  import and rows pulled from the server. Keep `rel="noopener noreferrer"`.
- Adding another synced table means: a migration with RLS and a test case, a
  pending map and cursor in `SyncState`, entries in `PushBatch` and
  `RemoteChanges`, a storage `migrate` step, and live updates (the
  `supabase_realtime` publication and `LIVE_TABLES`).

## Sync timing

A local change is pushed about a second after it is made (`PUSH_DEBOUNCE_MS`).
Other signed-in devices hear about it through Supabase Realtime
(`postgres_changes` on every synced table, filtered by `user_id`) and pull at
once; the notice carries no data the sync relies on. A 60-second poll and a
pull on focus or reconnect catch anything missed. A new synced table must be
added to the `supabase_realtime` publication and to `LIVE_TABLES` in
`useCloudSync.ts`.

New app versions: the service worker uses `registerType: 'prompt'`.
`useAppUpdates` checks every 30 minutes and on focus, and shows a toast with a
Reload button rather than reloading by itself.

## Deploying changes that touch the database

The live site talks to a real Supabase project with real user data. When a
change adds a migration, it must be applied to the Supabase project **before**
the code is pushed to `main`, either in the SQL editor or through the Supabase
connector. If the code goes first, sync
fails for signed-in users until the migration is applied (their data stays
safe on the device and syncs afterwards).

All eleven migrations in `supabase/migrations/` are applied to the live project
as of 2026-11-20.

## Releases

Add a short entry to `CHANGELOG.md` for every change users will notice, and
keep the README's feature list and screenshots in step with the app.

## Before opening sign-up to the public

- Configure a custom SMTP provider in Supabase (the built-in sender allows
  only a few emails an hour).
- Publish the Google OAuth consent screen (it starts in Testing mode).
