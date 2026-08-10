# Supabase schema (V1 foundation)

This folder holds the **database-only** foundation for migrating the BD Dashboard from `localStorage` to Supabase.

**Out of scope for V1 (intentionally unchanged):**

- Frontend / `AppContext` / localStorage
- Existing login UI
- Gmail Vercel API + encrypted cookies
- Chrome extension storage
- Supabase Storage buckets

## Apply the migration

### Option A — Supabase CLI

```bash
# From project root (link project first if needed)
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or apply the SQL file directly:

```bash
npx supabase db execute --file supabase/migrations/001_initial_schema.sql
```

### Option B — Dashboard SQL editor

1. Open your Supabase project → **SQL Editor**
2. Paste the contents of `migrations/001_initial_schema.sql`
3. Run once on an empty project (or a project that does not already have these tables)

### After apply — promote an admin

New Auth users get `profiles.role = 'user'` automatically. Promote your admin in SQL:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE username = 'your-admin-username';
```

Or by auth user id:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = '<auth-user-uuid>';
```

## Tables

| Table | Purpose |
|-------|---------|
| `profiles` | App user profile linked 1:1 to `auth.users` |
| `user_settings` | Per-user theme, notifications, streak, JSON preferences |
| `platform_strategies` | Admin/user outreach config per platform (`targets` JSONB) |
| `daily_sessions` | One work day per user (`UNIQUE(user_id, date)`) |
| `session_platforms` | Platform sections inside a day |
| `session_checklist_items` | Checklist rows under a session platform |
| `session_counters` | Counter metrics under a session platform |
| `session_timeline_blocks` | Timeline blocks for a day |
| `history_entries` | Finished-day snapshots (`UNIQUE(user_id, date)`) |
| `revenue_entries` | Revenue log lines |
| `notifications` | In-app notifications |

**Not created (by design):** `gmail_connections`, platform catalog table, Storage buckets.

## Relationships

```
auth.users
  └── profiles
        ├── user_settings (1:1)
        ├── platform_strategies (1:N, unique per platform)
        ├── daily_sessions (1:N, unique per date)
        │     ├── session_platforms (1:N)
        │     │     ├── session_checklist_items
        │     │     └── session_counters
        │     └── session_timeline_blocks
        ├── history_entries (1:N, unique per date)
        ├── revenue_entries (1:N)
        └── notifications (1:N)
```

Child rows use `ON DELETE CASCADE` from their parents.

## Platform values

Stored as `text` with CHECK constraints (no platforms table):

`fiverr`, `linkedin_saad`, `linkedin_umair`, `facebook`, `threads`, `x`, `whatsapp`, `instagram`, `upwork`, `review`

## JSONB shapes (conventions)

These are not enforced by schema beyond `jsonb NOT NULL`; the app will own the shape later.

**`user_settings.reminder_times`** — map of platform → `"HH:mm"`  
**`user_settings.enabled_platforms`** — array of platform ids  
**`user_settings.revenue_categories`** — array of category labels  
**`platform_strategies.targets`** — map of target keys → numbers (e.g. `{ "connections": 30 }`)  
**`history_entries.facebook_metrics`** — e.g. `{ "comments": 0, "dms": 0 }`  
**`history_entries.upwork_metrics`** — e.g. `{ "jobs_reviewed": 0, "proposals": 0 }`

History “tasks” from the analysis map to columns:

- `tasks_completed`
- `tasks_total`

## Auth profile creation

Trigger: `auth.users` → `public.handle_new_user()`

On each new Auth user:

1. Inserts `profiles` with `role = 'user'` (never auto-admin)
2. Inserts empty `user_settings` row

Username preference:

1. `raw_user_meta_data.username` if it matches `^[a-z0-9._-]{2,32}$`
2. Else sanitized email local-part / generated `user_<idfragment>`

Passwords live only in **Supabase Auth** — never in `profiles`.

## Admin model

- Admin = `profiles.role = 'admin'`
- Helper: `public.is_admin()` (`SECURITY DEFINER`, stable) — used by RLS so policies do **not** recurse on `profiles`
- Non-admins cannot change `profiles.role` (`protect_profile_role` trigger)
- Admins can read/write all user-owned tables (see RLS)

## RLS model

RLS is **enabled** on every public table above.

| Actor | Access |
|-------|--------|
| Authenticated owner (`user_id` / `profiles.id` = `auth.uid()`) | SELECT/INSERT/UPDATE/DELETE own rows |
| Admin (`is_admin()`) | SELECT/INSERT/UPDATE/DELETE across users (profiles delete = admin only for settings orphan cases) |
| Nested session rows | Authorized via `owns_session` / `owns_session_platform` (SECURITY DEFINER) |

No anonymous/public policies.

## Assumptions

1. One **daily session** and one **history entry** per `(user_id, date)` — matches current app upsert behavior; “Start New Day” same calendar day will overwrite/reuse the same session row when the frontend migrates.
2. **Daily targets / timeline templates** for strategy live in `platform_strategies` (+ session copies), not duplicated as `daily_targets` / `timeline` columns on `user_settings` in V1.
3. Gmail remains on Vercel cookies until a later migration.
4. Avatars remain under `/public` (`avatar_url` may store a path or future URL).
5. Promoting the first admin is a **manual SQL step** after creating the Auth user.
6. Username collisions on signup (email local-part) may fail the trigger insert — prefer passing unique `username` in Auth `raw_user_meta_data` when creating users.

## What this does *not* do

- Does not change the React app
- Does not remove or dual-write `localStorage`
- Does not migrate existing browser data
- Does not wire `@supabase/supabase-js`
- Does not create env vars (add `VITE_SUPABASE_URL` / keys later when integrating the client)
