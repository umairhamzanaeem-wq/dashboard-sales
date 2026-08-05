# BD Dashboard

Premium frontend-only Business Development Dashboard for tracking daily outreach across Fiverr, LinkedIn, Facebook, and Upwork.

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Framer Motion · Recharts · Lucide · React Hook Form · React Router

## Features

- Daily planner with platform workflows & live timeline timers
- KPI tracker with targets, counters, and completion badges
- End-of-day scorecard with confetti at 100%
- Revenue tracking with charts
- Analytics, history (calendar / timeline / table), settings
- Browser notifications on schedule
- Full LocalStorage persistence + JSON export/import

## Run

Requires **Node 20+**.

```bash
nvm use   # if you use nvm (.nvmrc included)
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview
```

## Data

Everything is stored in `localStorage` under `bd-dashboard-v1`. Use **Settings → Export JSON** to back up.
