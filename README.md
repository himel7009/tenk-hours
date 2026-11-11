# Tenk — 10,000 Hours Tracker

> **Track the hours you put into a skill on the way to 10,000.**

[![Deploy](https://github.com/himel7009/tenk-hours/actions/workflows/deploy.yml/badge.svg)](https://github.com/himel7009/tenk-hours/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/demo-online-brightgreen.svg)](https://himel7009.github.io/tenk-hours/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**[✨ View Live Demo ✨](https://himel7009.github.io/tenk-hours/)**

Tenk is a clean, distraction-free web app and PWA for mastering any craft. Add a skill, time your practice sessions or log them manually, and watch a grid of 10,000 squares fill in hour by hour. Tenk also tracks daily streaks, a 26-week activity heatmap, milestone achievements, and projected finish dates based on your recent pace.

Everything is stored locally in your browser — zero accounts, zero tracking, zero cloud dependencies.

---

## 📸 Demo & Screenshots

### 1. Dashboard & Skills Overview
Track today's practice at a glance, maintain your active streak, and monitor your full skill portfolio.

![Tenk Dashboard](docs/screenshots/dashboard.png)

### 2. Deep-Dive Skill Tracker
Visualise your 10,000-hour journey with an interactive practice timer, milestone ladder, 26-week activity heatmap, pace calculation, and session history.

![Skill Detail View](docs/screenshots/skill-detail.png)

### 3. Responsive & Mobile-Ready (PWA)
Optimised for mobile, tablet, and desktop screens with dark and light theme support.

<p align="center">
  <img src="docs/screenshots/mobile-view.png" alt="Tenk Mobile View" width="360" />
</p>

---

## ⚡ Features

- **⏱ Flexible Time Tracking**: Built-in stopwatch timer with auto-save, plus manual logging for past practice.
- **⬛ 10,000-Hour Visual Grid**: Every single hour completed is reflected visually on your skill field.
- **🔥 Daily Streaks & Pace**: Real-time streak counter and 30-day average pace tracking.
- **🎯 Milestone Progress**: Step-by-step milestones (1h, 10h, 50h, 100h, 250h, 500h, 1,000h, 2,500h, 5,000h, 7,500h, 10,000h).
- **📅 26-Week Heatmap**: GitHub-style activity calendar for each skill.
- **🔮 Finish Date Projections**: Automatically estimates when you'll reach your target based on recent consistency.
- **🔒 100% Private & Offline**: Stored entirely in `localStorage`. Includes one-click JSON backup export and restore.
- **📱 Installable PWA**: Works offline and can be added directly to your phone or desktop home screen.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 22 or newer
- npm

### Local Development

```sh
# Clone the repository
git clone https://github.com/himel7009/tenk-hours.git
cd tenk-hours

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

| Command           | What it does                       |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Start the Vite dev server          |
| `npm test`        | Run unit tests with Vitest         |
| `npm run lint`    | Lint code with ESLint              |
| `npm run format`  | Format codebase with Prettier      |
| `npm run build`   | Type-check and build to `dist/`    |
| `npm run preview` | Serve the production build locally |

---

## 🏗 Project Architecture

```
src/
  app/        App shell, router, and theme wiring
  components/ Shared UI primitives (Button, Dialog, Field, Toast)
  data/       Backup export/import schema validation
  domain/     Pure business logic: dates, streaks, stats, milestones, formatting
  features/   Feature modules: skills, sessions, timer, progress, settings
  store/      Zustand stores (trackerStore persisted in localStorage)
  styles/     CSS design tokens and global styles
```

- **Domain-First Design**: The `domain/` directory contains pure TypeScript logic with comprehensive unit tests and zero UI dependencies.
- **Hash Routing**: Uses `HashRouter` to allow deep linking on GitHub Pages without server redirects.

---

## 🌐 Deployment to GitHub Pages

The workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) automatically runs linting, tests, builds, and deploys on every push to `main`.

Live deployment URL: **[https://himel7009.github.io/tenk-hours/](https://himel7009.github.io/tenk-hours/)**

---

## 📱 Mobile & PWA Installation

Tenk is a Progressive Web App (PWA):
- **On Android**: Open the live site in Chrome and tap **Add to Home screen**.
- **On iOS**: Open in Safari, tap the share icon, and select **Add to Home Screen**.
- **On Desktop**: Click the install icon in your browser address bar.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
