# BD Dashboard

Premium Business Development Dashboard for tracking daily outreach across Fiverr, LinkedIn, Facebook, and Upwork.

## Logins

| Username | Password |
|----------|----------|
| `saad`   | `saad`   |
| `umair`  | `umair`  |

Both users share the **same** dashboard data (history, revenue, daily progress) so the team stays consistent.

## Stack

- React + TypeScript + Vite
- Tailwind CSS · Framer Motion · Recharts · Lucide
- Cloud sync via Vercel serverless API + Upstash Redis

## Run locally

Requires **Node 20+**.

```bash
nvm use
npm install
npm run dev
```

Local mode uses browser storage. Cross-device sync needs Redis (see below).

## Deploy on Vercel + multi-device sync

1. Deploy the GitHub repo to Vercel (Framework: Vite, Output: `dist`, Node 20).
2. In Vercel project → **Storage** → create **Upstash Redis** → **Connect** to this project.
3. **Redeploy** so env vars (`KV_REST_API_*` or `UPSTASH_REDIS_REST_*`) are available.
4. Open the site → log in → data syncs across phones/laptops.

Without Redis, login still works but data stays on each device only.

## Daily use

1. **Login**
2. **Start Day**
3. Work in **Daily Planner** / **Tracker**
4. **Finish Day** → saved to **History** (and cloud if Redis is connected)

## Build

```bash
npm run build
npm run preview
```
