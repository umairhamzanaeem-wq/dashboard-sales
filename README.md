# BD Dashboard

Premium Business Development Dashboard for tracking daily outreach across Fiverr, LinkedIn, Facebook, and Upwork.

## Logins

| Username | Password |
|----------|----------|
| `saad`   | `saad`   |
| `umair`  | `umair`  |

Each user has their **own** Local Storage JSON on that device (`bd-dashboard-v1:saad` / `bd-dashboard-v1:umair`).

## Stack

- React + TypeScript + Vite
- Tailwind CSS · Framer Motion · Recharts · Lucide
- Data: browser **Local Storage** (JSON) — no cloud/backend

## Run locally

Requires **Node 20+**.

```bash
nvm use
npm install
npm run dev
```

## Daily use

1. Login  
2. **Start Day**  
3. Work in Planner / Tracker  
4. **Finish Day** → saved to **History** in Local Storage  

## Move data between devices

Use **Settings → Export JSON** on one device, then **Import JSON** on another.

## Deploy

Vercel: Framework Vite, Output `dist`, Node 20. No Redis/KV needed.

## Build

```bash
npm run build
npm run preview
```
