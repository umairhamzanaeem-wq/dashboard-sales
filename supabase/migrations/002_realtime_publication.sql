-- Optional: enable Realtime for cross-device live sync (Dashboard → Database → Publications
-- or run this in the SQL editor). Polling still works if Realtime is off.

ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.history_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.revenue_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_strategies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
