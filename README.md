# Tenk

Track the hours you put into a skill on the way to 10,000.

Add a skill, time your practice or log it afterwards, and watch a grid of
10,000 squares fill in one hour at a time. Tenk also keeps a daily streak, a
26-week activity calendar, milestones along the way and a projected finish date
based on your recent pace.

Everything is stored in your browser. There is no account and no server.

## Getting started

Requires Node 22 or newer.

```sh
npm install
npm run dev
```

| Command           | What it does                       |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Start the dev server               |
| `npm test`        | Run the unit tests                 |
| `npm run lint`    | Lint with ESLint                   |
| `npm run format`  | Format with Prettier               |
| `npm run build`   | Type-check and build to `dist/`    |
| `npm run preview` | Serve the production build locally |

## Project layout

```
src/
  app/        Shell, routes and theme wiring
  components/ Shared UI primitives (Button, Dialog, Field, Toast)
  data/       Backup export and import, with validation
  domain/     Pure logic: dates, streaks, stats, milestones, formatting
  features/   One folder per feature: skills, sessions, timer, progress, settings
  store/      Zustand stores; trackerStore is persisted to localStorage
  styles/     Design tokens and global styles
```

The rule that keeps this easy to change: `domain/` knows nothing about React or
storage, and components never compute streaks or totals themselves. New
measures (weekly goals, per-skill reminders) belong in `domain/` with tests,
then get surfaced through a hook in `features/progress/`.

### Data model

A **skill** has a name, colour and target hours. A **session** is a number of
minutes on a local calendar day, created by the timer or entered by hand, and
can be edited or deleted afterwards. Streaks, totals and projections are always
derived from sessions and never stored.

The persisted state is versioned (`STORAGE_VERSION` in `store/trackerStore.ts`).
When its shape changes, bump the version and add a `migrate` step so existing
users keep their data.

### Adding sync later

All reads and writes go through `trackerStore`. To add accounts and cloud sync,
swap the `persist` storage for one backed by an API and keep the action
signatures; nothing in `features/` needs to change.

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` lints, tests, builds and deploys
on every push to `main`.

1. Create a repository on GitHub and push this project to its `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to
   **GitHub Actions**.
3. Push again, or re-run the workflow from the **Actions** tab. The site is
   published at `https://<username>.github.io/<repository>/`.

The build uses relative asset paths and hash routing, so it works under any
repository name without configuration.

## Android

Tenk is an installable PWA: open the deployed site in Chrome on Android and
choose **Add to Home screen**. For a Play Store build, the same code can be
wrapped with [Capacitor](https://capacitorjs.com/).

## License

MIT
