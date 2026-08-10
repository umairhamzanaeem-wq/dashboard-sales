-- =============================================================================
-- BD Dashboard — initial Supabase schema (V1)
-- Foundation only: no frontend cutover, no Gmail tables, no Storage buckets.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Helpers: updated_at
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'user'
    CHECK (role IN ('admin', 'user')),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_unique UNIQUE (username),
  CONSTRAINT profiles_username_format CHECK (
    username ~ '^[a-z0-9._-]{2,32}$'
  )
);

CREATE INDEX profiles_role_idx ON public.profiles (role);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Admin check AFTER profiles exists (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- Prevent non-admins from escalating their role
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change profile roles';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

-- -----------------------------------------------------------------------------
-- user_settings (1:1 with profiles)
-- -----------------------------------------------------------------------------

CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'ignite-dark'
    CHECK (theme IN ('ignite-dark', 'ignite-light', 'classic-dark', 'classic-light')),
  notifications_enabled boolean NOT NULL DEFAULT true,
  reminder_times jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled_platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  revenue_categories jsonb NOT NULL DEFAULT '["Fiverr","Upwork","Direct Clients","Agency","Referral"]'::jsonb,
  streak integer NOT NULL DEFAULT 0 CHECK (streak >= 0),
  last_completed_date date,
  last_streak_at timestamptz,
  longest_streak integer NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER user_settings_set_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- platform_strategies
-- -----------------------------------------------------------------------------

CREATE TABLE public.platform_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  platform text NOT NULL
    CHECK (platform IN (
      'fiverr',
      'linkedin_saad',
      'linkedin_umair',
      'facebook',
      'threads',
      'x',
      'whatsapp',
      'instagram',
      'upwork',
      'review'
    )),
  enabled boolean NOT NULL DEFAULT true,
  estimated_minutes integer NOT NULL DEFAULT 30 CHECK (estimated_minutes >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  targets jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_strategies_user_platform_unique UNIQUE (user_id, platform)
);

CREATE INDEX platform_strategies_user_id_idx ON public.platform_strategies (user_id);
CREATE INDEX platform_strategies_user_sort_idx ON public.platform_strategies (user_id, sort_order);

CREATE TRIGGER platform_strategies_set_updated_at
  BEFORE UPDATE ON public.platform_strategies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- daily_sessions
-- -----------------------------------------------------------------------------

CREATE TABLE public.daily_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  date date NOT NULL,
  day_status text NOT NULL DEFAULT 'not_started'
    CHECK (day_status IN ('not_started', 'in_progress', 'paused', 'finished')),
  day_started_at timestamptz,
  day_finished_at timestamptz,
  daily_notes text NOT NULL DEFAULT '',
  confetti_shown boolean NOT NULL DEFAULT false,
  total_time_worked_seconds integer NOT NULL DEFAULT 0
    CHECK (total_time_worked_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_sessions_user_date_unique UNIQUE (user_id, date)
);

CREATE INDEX daily_sessions_user_id_idx ON public.daily_sessions (user_id);
CREATE INDEX daily_sessions_date_idx ON public.daily_sessions (date);
CREATE INDEX daily_sessions_user_date_idx ON public.daily_sessions (user_id, date);

CREATE TRIGGER daily_sessions_set_updated_at
  BEFORE UPDATE ON public.daily_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- session_platforms
-- -----------------------------------------------------------------------------

CREATE TABLE public.session_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.daily_sessions (id) ON DELETE CASCADE,
  platform text NOT NULL
    CHECK (platform IN (
      'fiverr',
      'linkedin_saad',
      'linkedin_umair',
      'facebook',
      'threads',
      'x',
      'whatsapp',
      'instagram',
      'upwork',
      'review'
    )),
  name text NOT NULL,
  estimated_minutes integer NOT NULL DEFAULT 0 CHECK (estimated_minutes >= 0),
  purpose text,
  notes text NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_platforms_session_platform_unique UNIQUE (session_id, platform)
);

CREATE INDEX session_platforms_session_id_idx ON public.session_platforms (session_id);

CREATE TRIGGER session_platforms_set_updated_at
  BEFORE UPDATE ON public.session_platforms
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- session_checklist_items
-- -----------------------------------------------------------------------------

CREATE TABLE public.session_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_platform_id uuid NOT NULL REFERENCES public.session_platforms (id) ON DELETE CASCADE,
  item_key text NOT NULL,
  label text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_checklist_items_platform_key_unique UNIQUE (session_platform_id, item_key)
);

CREATE INDEX session_checklist_items_session_platform_id_idx
  ON public.session_checklist_items (session_platform_id);

CREATE TRIGGER session_checklist_items_set_updated_at
  BEFORE UPDATE ON public.session_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- session_counters
-- -----------------------------------------------------------------------------

CREATE TABLE public.session_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_platform_id uuid NOT NULL REFERENCES public.session_platforms (id) ON DELETE CASCADE,
  counter_key text NOT NULL,
  label text NOT NULL,
  target integer NOT NULL DEFAULT 0 CHECK (target >= 0),
  completed integer NOT NULL DEFAULT 0 CHECK (completed >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_counters_platform_key_unique UNIQUE (session_platform_id, counter_key)
);

CREATE INDEX session_counters_session_platform_id_idx
  ON public.session_counters (session_platform_id);

CREATE TRIGGER session_counters_set_updated_at
  BEFORE UPDATE ON public.session_counters
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- session_timeline_blocks
-- -----------------------------------------------------------------------------

CREATE TABLE public.session_timeline_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.daily_sessions (id) ON DELETE CASCADE,
  platform text NOT NULL
    CHECK (platform IN (
      'fiverr',
      'linkedin_saad',
      'linkedin_umair',
      'facebook',
      'threads',
      'x',
      'whatsapp',
      'instagram',
      'upwork',
      'review'
    )),
  name text NOT NULL,
  start_time time NOT NULL,
  estimated_minutes integer NOT NULL DEFAULT 0 CHECK (estimated_minutes >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'paused', 'completed', 'skipped')),
  elapsed_seconds integer NOT NULL DEFAULT 0 CHECK (elapsed_seconds >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_timeline_blocks_session_platform_unique UNIQUE (session_id, platform)
);

CREATE INDEX session_timeline_blocks_session_id_idx
  ON public.session_timeline_blocks (session_id);

CREATE TRIGGER session_timeline_blocks_set_updated_at
  BEFORE UPDATE ON public.session_timeline_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- history_entries (denormalized daily snapshot; one per user/date)
-- -----------------------------------------------------------------------------

CREATE TABLE public.history_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  date date NOT NULL,
  completion_percent integer NOT NULL DEFAULT 0
    CHECK (completion_percent >= 0 AND completion_percent <= 100),
  tasks_completed integer NOT NULL DEFAULT 0 CHECK (tasks_completed >= 0),
  tasks_total integer NOT NULL DEFAULT 0 CHECK (tasks_total >= 0),
  connections integer NOT NULL DEFAULT 0 CHECK (connections >= 0),
  follow_ups integer NOT NULL DEFAULT 0 CHECK (follow_ups >= 0),
  facebook_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  upwork_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  revenue_total numeric(12, 2) NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  time_worked_seconds integer NOT NULL DEFAULT 0 CHECK (time_worked_seconds >= 0),
  productivity_score integer NOT NULL DEFAULT 0,
  day_started_at timestamptz,
  day_finished_at timestamptz,
  day_status text
    CHECK (day_status IS NULL OR day_status IN ('not_started', 'in_progress', 'paused', 'finished')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT history_entries_user_date_unique UNIQUE (user_id, date)
);

CREATE INDEX history_entries_user_id_idx ON public.history_entries (user_id);
CREATE INDEX history_entries_date_idx ON public.history_entries (date);
CREATE INDEX history_entries_user_date_idx ON public.history_entries (user_id, date);

CREATE TRIGGER history_entries_set_updated_at
  BEFORE UPDATE ON public.history_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- revenue_entries
-- -----------------------------------------------------------------------------

CREATE TABLE public.revenue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  date date NOT NULL,
  platform text NOT NULL,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  client text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX revenue_entries_user_id_idx ON public.revenue_entries (user_id);
CREATE INDEX revenue_entries_date_idx ON public.revenue_entries (date);
CREATE INDEX revenue_entries_user_date_idx ON public.revenue_entries (user_id, date);

CREATE TRIGGER revenue_entries_set_updated_at
  BEFORE UPDATE ON public.revenue_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  time text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  type text NOT NULL DEFAULT 'info'
    CHECK (type IN ('schedule', 'reminder', 'achievement', 'info')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_id_idx ON public.notifications (user_id);
CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id)
  WHERE read = false;

-- -----------------------------------------------------------------------------
-- Auth → profile (+ empty settings) on signup
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_username text;
  meta_display text;
  safe_username text;
BEGIN
  meta_username := lower(trim(COALESCE(NEW.raw_user_meta_data->>'username', '')));
  meta_display := trim(COALESCE(NEW.raw_user_meta_data->>'display_name', ''));

  IF meta_username ~ '^[a-z0-9._-]{2,32}$' THEN
    safe_username := meta_username;
  ELSE
    -- Fallback from email local-part; suffix with short id fragment if needed later by app
    safe_username := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9._-]', '', 'g'));
    IF char_length(safe_username) < 2 THEN
      safe_username := 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8);
    END IF;
    IF char_length(safe_username) > 32 THEN
      safe_username := substr(safe_username, 1, 32);
    END IF;
  END IF;

  IF meta_display = '' THEN
    meta_display := initcap(replace(safe_username, '_', ' '));
  END IF;

  INSERT INTO public.profiles (id, username, display_name, role, avatar_url)
  VALUES (
    NEW.id,
    safe_username,
    meta_display,
    'user',
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')), '')
  );

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Ownership helper for nested session rows (SECURITY DEFINER, no recursion)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.owns_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.daily_sessions s
    WHERE s.id = p_session_id
      AND (s.user_id = auth.uid() OR public.is_admin())
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_session_platform(p_session_platform_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.session_platforms sp
    JOIN public.daily_sessions s ON s.id = sp.session_id
    WHERE sp.id = p_session_platform_id
      AND (s.user_id = auth.uid() OR public.is_admin())
  );
$$;

REVOKE ALL ON FUNCTION public.owns_session(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_session_platform(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_session_platform(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_session(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.owns_session_platform(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_timeline_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- profiles ------------------------------------------------------------------

CREATE POLICY profiles_select_own_or_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_update_own_or_admin
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Inserts normally come from handle_new_user (SECURITY DEFINER).
-- Admins may insert profiles only when provisioning edge cases.
CREATE POLICY profiles_insert_admin
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY profiles_delete_admin
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- user_settings -------------------------------------------------------------

CREATE POLICY user_settings_select_own_or_admin
  ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY user_settings_insert_own_or_admin
  ON public.user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY user_settings_update_own_or_admin
  ON public.user_settings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY user_settings_delete_admin
  ON public.user_settings
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- platform_strategies -------------------------------------------------------

CREATE POLICY platform_strategies_select_own_or_admin
  ON public.platform_strategies
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY platform_strategies_insert_own_or_admin
  ON public.platform_strategies
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY platform_strategies_update_own_or_admin
  ON public.platform_strategies
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY platform_strategies_delete_own_or_admin
  ON public.platform_strategies
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- daily_sessions ------------------------------------------------------------

CREATE POLICY daily_sessions_select_own_or_admin
  ON public.daily_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY daily_sessions_insert_own_or_admin
  ON public.daily_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY daily_sessions_update_own_or_admin
  ON public.daily_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY daily_sessions_delete_own_or_admin
  ON public.daily_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- session_platforms ---------------------------------------------------------

CREATE POLICY session_platforms_select_own_or_admin
  ON public.session_platforms
  FOR SELECT
  TO authenticated
  USING (public.owns_session(session_id));

CREATE POLICY session_platforms_insert_own_or_admin
  ON public.session_platforms
  FOR INSERT
  TO authenticated
  WITH CHECK (public.owns_session(session_id));

CREATE POLICY session_platforms_update_own_or_admin
  ON public.session_platforms
  FOR UPDATE
  TO authenticated
  USING (public.owns_session(session_id))
  WITH CHECK (public.owns_session(session_id));

CREATE POLICY session_platforms_delete_own_or_admin
  ON public.session_platforms
  FOR DELETE
  TO authenticated
  USING (public.owns_session(session_id));

-- session_checklist_items ---------------------------------------------------

CREATE POLICY session_checklist_items_select_own_or_admin
  ON public.session_checklist_items
  FOR SELECT
  TO authenticated
  USING (public.owns_session_platform(session_platform_id));

CREATE POLICY session_checklist_items_insert_own_or_admin
  ON public.session_checklist_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.owns_session_platform(session_platform_id));

CREATE POLICY session_checklist_items_update_own_or_admin
  ON public.session_checklist_items
  FOR UPDATE
  TO authenticated
  USING (public.owns_session_platform(session_platform_id))
  WITH CHECK (public.owns_session_platform(session_platform_id));

CREATE POLICY session_checklist_items_delete_own_or_admin
  ON public.session_checklist_items
  FOR DELETE
  TO authenticated
  USING (public.owns_session_platform(session_platform_id));

-- session_counters ----------------------------------------------------------

CREATE POLICY session_counters_select_own_or_admin
  ON public.session_counters
  FOR SELECT
  TO authenticated
  USING (public.owns_session_platform(session_platform_id));

CREATE POLICY session_counters_insert_own_or_admin
  ON public.session_counters
  FOR INSERT
  TO authenticated
  WITH CHECK (public.owns_session_platform(session_platform_id));

CREATE POLICY session_counters_update_own_or_admin
  ON public.session_counters
  FOR UPDATE
  TO authenticated
  USING (public.owns_session_platform(session_platform_id))
  WITH CHECK (public.owns_session_platform(session_platform_id));

CREATE POLICY session_counters_delete_own_or_admin
  ON public.session_counters
  FOR DELETE
  TO authenticated
  USING (public.owns_session_platform(session_platform_id));

-- session_timeline_blocks ---------------------------------------------------

CREATE POLICY session_timeline_blocks_select_own_or_admin
  ON public.session_timeline_blocks
  FOR SELECT
  TO authenticated
  USING (public.owns_session(session_id));

CREATE POLICY session_timeline_blocks_insert_own_or_admin
  ON public.session_timeline_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.owns_session(session_id));

CREATE POLICY session_timeline_blocks_update_own_or_admin
  ON public.session_timeline_blocks
  FOR UPDATE
  TO authenticated
  USING (public.owns_session(session_id))
  WITH CHECK (public.owns_session(session_id));

CREATE POLICY session_timeline_blocks_delete_own_or_admin
  ON public.session_timeline_blocks
  FOR DELETE
  TO authenticated
  USING (public.owns_session(session_id));

-- history_entries -----------------------------------------------------------

CREATE POLICY history_entries_select_own_or_admin
  ON public.history_entries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY history_entries_insert_own_or_admin
  ON public.history_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY history_entries_update_own_or_admin
  ON public.history_entries
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY history_entries_delete_own_or_admin
  ON public.history_entries
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- revenue_entries -----------------------------------------------------------

CREATE POLICY revenue_entries_select_own_or_admin
  ON public.revenue_entries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY revenue_entries_insert_own_or_admin
  ON public.revenue_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY revenue_entries_update_own_or_admin
  ON public.revenue_entries
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY revenue_entries_delete_own_or_admin
  ON public.revenue_entries
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- notifications -------------------------------------------------------------

CREATE POLICY notifications_select_own_or_admin
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY notifications_insert_own_or_admin
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY notifications_update_own_or_admin
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY notifications_delete_own_or_admin
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
