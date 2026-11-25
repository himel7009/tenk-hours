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
  UI libraries without asking. (Item colours are the exception, below.)
- Panels use `background: var(--surface)`, `backdrop-filter:
var(--glass-filter, none)`, `border: 1px solid var(--panel-border,
var(--line))` and `box-shadow: var(--glass-edge, none)`. Filled surfaces
  go by role, never raw ink: `--fill`/`--on-fill` (selected tabs, segments,
  days), `--accent-fill`/`--on-accent` (primary actions), `--hero-fill`/
  `--on-hero` (the one big card on a page, which also resets `--on-ink`).
  In the solid style all of these resolve to the old values. The Glass
  style ("Aurora glass": `surface` in the store, per device, `<html
data-surface>`, `styles/glass.css`, plus `:global(:root[data-surface='glass'])`
  rules in Button, AppLayout and the hero cards) restyles each role. A new
  panel or filled control should follow the same tokens. Glass is skipped
  where blur is unsupported or the system asks for reduced transparency.
- UI copy is plain sentence case. Buttons say what they do ("Save changes").
- Names wrap (`overflow-wrap: anywhere`); never cut user text off with an
  ellipsis. The running timer bar alone clamps to two lines.

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
  plans the week. Every skill, habit and project has its own (`routineOf`),
  in a domain or not. Until v16 a skill in a domain followed the domain's
  days; the v16 storage step and the matching migration copied them over
  (`inheritDomainRoutines`). A day off the routine neither counts nor breaks
  a streak (`computeStreak`'s `isDayOff`); time put in on a day off counts.
  Today's goals, a domain's daily plan and the report's goal days include only
  planned days. Changing a routine reinterprets past days too.
- Single days can differ from the routine (`addedDays`, `skippedDays`, columns
  `added_days`, `skipped_days`), stored on each tracker (`planOf`,
  `routineOf`, `changeDay`). `isPlannedOn`
  (routine plus added, less skipped) decides what Today, the week card and
  the to-do list show; `isRequiredOn` (routine less skipped) decides what a
  missed goal costs, so skipping never breaks a streak and an added day is a
  bonus. The lists are kept for good, since past streaks read them. Changed
  from the Change a day dialog (`ChangeDayDialog`, `buildDayPlan`) on the
  Today tab and the week card.
- Domains have no days of their own. A domain is on whenever one of its
  trackers is (`isDomainPlannedOn`); its streak skips days when none of its
  streak-keeping skills is required. The routine grid (`RoutineDialog`) lists
  trackers under their domain, whose row sets a day for all of them
  (`setWeekday`). Start over edits a blank draft (no days means none picked
  yet) and saves it all at once; anything left without days becomes every
  day. It opens as a wide dialog (`Dialog` `size="wide"`). View routine
  (`RoutineView`, `buildRoutineView`) shows the weekly routine read-only by
  day and domain, without day changes. `domains.routine_days`, `added_days` and `skipped_days` are
  kept in the table but no longer read; `domainPlan` stands in for a domain
  where old to-dos still point at one.
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
Today tab (`TodayTab`) shows the to-do list (grouped by domain and skill), then every project planned
today (wherever it sits), then the domains with a skill on today, listing
only those skills (`plannedOn`) and naming the rest, without their projects
(`hideProjects`). The Projects tab
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

`Todo` (table `todos`, `domain/todos.ts`) belongs to a domain (`domainId`), a
tracker (`skillId`) or neither (General), never both, and is planned for a
`day`. It has its own sync cursor (`sync.todoCursor`) and is in backups.

- New to-dos are offered General and every skill, habit and project
  (`todoTargets`), not domains; a to-do already under a domain keeps it.
  The picker follows the routine: it lists only the projects, skills and
  habits planned for the chosen day, grouped by kind (`groupTodoTargets`;
  an empty routine means every day). Changing the day drops a pick that is
  off that day back to General (`isTargetOpenOn`); the edit dialog keeps the
  to-do's own place listed.
- An undone to-do whose day has passed shows on the next working day of its
  domain or skill (`planTodo`, `nextPlannedDay` from the routine); General
  moves to the next day. Only the first planned day is stored: where it shows
  now and how often it moved are worked out, never written back.
- The list labels each group Skill, Habit or Project (`targetKindName`) and
  each to-do with its age (`PlannedTodo.age`): calendar days since it was
  added, counting that day as day 1, stopping when done. Worked out from
  `createdAt`, never stored.
- An optional `deadline` (column `deadline`, null for none) is separate from
  `day`, which moves on by itself. `PlannedTodo.daysLeft` and
  `describeDeadline` give the countdown (soon from two days out, overdue
  after). Today's list sorts by nearest deadline and also takes in any
  to-do whose deadline has come, even if planned later.
- An optional `url` (column `url`, '' for none) links a video or page.
  `cleanTodoUrl` adds https:// when missing and turns away anything else;
  the store, sync and backups keep only `isWebUrl` links. It renders as a
  link beside the edit button (never inside it), opening in a new tab.
- Today's list scrolls inside its card (`todayList`, about eight rows) so a
  long day does not push the rest of the Today tab down.
- The history (`buildTodoHistory`) reads `doneAt` and those planned days: what
  was done each day and what was planned but moved on. Done to-dos are kept,
  not cleared. A to-do whose domain or skill is deleted becomes General.

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
- Debts (`domain/debts.ts`, tables `money_debts` and `money_debt_payments`,
  same cursor): `borrowed` (you owe) or `lent` (owed to you), with an optional
  `dueDay`. Payments settle them in part or whole. A debt's `sectionId` and
  each payment's say which section the money went through. By default that is
  only a record: borrowed money is usually already in the budget written
  down, and counting it again doubled it. Only a debt with `inBudget` on (and
  its payments) feeds `debtFlows` into section balances (borrowed and paid
  back to you add, repaid and lent take away), never into spending. Debts
  stored before v15 became records. Deleting a section keeps its debts and
  clears their `sectionId`.
- The calculator (`Calculator.tsx`, maths in `domain/calc.ts`) parses sums
  itself and never evaluates text as code. Percent follows phone calculators
  (500 + 10% is 550). Its result reaches the expense line by remounting
  `QuickAdd` with `initialText`.
- The bad habits PIN (`badHabitLock`) also hides money (`usePrivacyLocked`).
  Deleting a section deletes its entries and any moves into it.

## Colours and icons

Skills, habits, projects, domains, bad habits and money sections each have an
`icon` (one emoji) and a `color`, and they share one pool
(`domain/appearance.ts`).

- `color` is one of the twelve `SKILL_COLORS` (light and dark values in
  `tokens.css`) or a custom lowercase `#rrggbb`. `isSkillColor` and the
  database checks accept exactly that; anything else becomes cobalt in a
  backup. Custom colours get their `[data-color]` rule from
  `CustomColorStyles` at the app root (`customColorCss` writes only values
  that pass the check, so stored text cannot inject CSS).
- New items are filled in by `useLook`: `pickColor` (the least used named
  colour) and `suggestEmoji` (the best unused match for the name from
  `KEYWORDS`, then the kind's pool). The icon follows the name until picked
  by hand. Edited items keep their look. Repeats are allowed when chosen,
  but marked with who else uses them.
- `LookPicker` is the shared form field. Its full list is
  `src/data/emojiLibrary.json`, generated from emojibase-data by
  `npm run emoji` (Emoji 14 and older, so nothing shows as an empty box) and
  loaded only when opened.
- `fixRepeatedLooks` (Settings) gives items that repeat an older item's icon
  or colour a new one (`planLookFixes`).

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

- An optional `deadline` (column `deadline`) to finish by. `libraryDeadline`
  gives the countdown (wording shared with to-dos in `domain/deadline.ts`)
  and, with a known total, the pace to finish on time; nothing once done.
  Lists sort by nearest deadline.
- `url` (here and on to-dos) is the only user-supplied value rendered as a
  link. It must pass `isWebUrl` (http or https only) wherever it enters the
  app: the form, backup import and rows pulled from the server, and the
  column checks the same. Keep `rel="noopener noreferrer"`.
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

New app versions: the service worker uses `registerType: 'autoUpdate'`, so a
new version installs and takes over by itself (skipWaiting, clientsClaim) even
on a phone that never closes its tab. Do not switch back to `'prompt'`: on
2026-11-18 that left phones on the first version, waiting for a click their
old code could not show. `useAppUpdates` checks every 30 minutes and on focus,
and once a new version has taken over (`onNeedReload`) shows a toast with a
Reload button rather than reloading the open page. Settings shows the build
(`__APP_VERSION__`) so a device's version can be checked.

## Deploying changes that touch the database

The live site talks to a real Supabase project with real user data. When a
change adds a migration, it must be applied to the Supabase project **before**
the code is pushed to `main`, either in the SQL editor or through the Supabase
connector. If the code goes first, sync
fails for signed-in users until the migration is applied (their data stays
safe on the device and syncs afterwards).

All twenty migrations in `supabase/migrations/` are applied to the live project
as of 2026-11-25.

## Releases

Add a short entry to `CHANGELOG.md` for every change users will notice, and
keep the README's feature list and screenshots in step with the app.

## Before opening sign-up to the public

- Configure a custom SMTP provider in Supabase (the built-in sender allows
  only a few emails an hour).
- Publish the Google OAuth consent screen (it starts in Testing mode).
