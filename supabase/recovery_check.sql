-- Run in Supabase SQL Editor (while logged into your project)
-- Checks whether any outreach counters still exist for recovery.

SELECT
  ds.date,
  ds.day_status,
  sp.platform,
  sc.counter_key,
  sc.label,
  sc.completed,
  sc.target,
  ds.updated_at
FROM public.daily_sessions ds
JOIN public.session_platforms sp ON sp.session_id = ds.id
JOIN public.session_counters sc ON sc.session_platform_id = sp.id
JOIN public.profiles p ON p.id = ds.user_id
WHERE p.username ILIKE '%umair%'
  AND sc.completed > 0
ORDER BY ds.date DESC, sp.platform, sc.counter_key;

-- Also check history snapshots
SELECT date, completion_percent, connections, follow_ups, tasks_completed, notes, updated_at
FROM public.history_entries he
JOIN public.profiles p ON p.id = he.user_id
WHERE p.username ILIKE '%umair%'
ORDER BY date DESC
LIMIT 20;
