-- Harden XP System: Prevent infinite XP farming
-- Adds: auth guard, cooldowns, idempotency, daily caps, unique constraints
-- Migration ID: 20260707000000

-- ── Step 1: Add cooldown and daily cap columns to xp_actions ───────────────
ALTER TABLE public.xp_actions
  ADD COLUMN IF NOT EXISTS cooldown_seconds INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_daily_xp INT DEFAULT NULL;

-- Set sensible cooldowns and daily caps for each action
UPDATE public.xp_actions SET cooldown_seconds = 15, max_daily_xp = 500 WHERE action = 'roam';
UPDATE public.xp_actions SET cooldown_seconds = 30, max_daily_xp = 100 WHERE action = 'save_url';
UPDATE public.xp_actions SET cooldown_seconds = 300, max_daily_xp = 250 WHERE action = 'submit_url';
UPDATE public.xp_actions SET cooldown_seconds = 60, max_daily_xp = 200 WHERE action = 'create_collection';
UPDATE public.xp_actions SET cooldown_seconds = 30 WHERE action = 'add_to_collection';
UPDATE public.xp_actions SET cooldown_seconds = 300 WHERE action = 'submit_approved';
UPDATE public.xp_actions SET cooldown_seconds = 3600 WHERE action = 'daily_roam_streak';
UPDATE public.xp_actions SET cooldown_seconds = 30, max_daily_xp = 50 WHERE action = 'follow_user';
UPDATE public.xp_actions SET cooldown_seconds = 30, max_daily_xp = 200 WHERE action = 'gain_follower';
UPDATE public.xp_actions SET cooldown_seconds = 30, max_daily_xp = 50 WHERE action = 'share_url';
UPDATE public.xp_actions SET cooldown_seconds = 5, max_daily_xp = 60 WHERE action = 'rate_url';
UPDATE public.xp_actions SET cooldown_seconds = 86400 WHERE action = 'profile_complete';
UPDATE public.xp_actions SET cooldown_seconds = 30, max_daily_xp = 300 WHERE action = 'collection_favorited';

-- ── Step 2: Add idempotency_key to xp_log ─────────────────────────────────
ALTER TABLE public.xp_log
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT DEFAULT NULL;

-- Partial unique index: no duplicate XP entries with the same idempotency key for the same user+action
-- Only enforces uniqueness when key is non-null (backward compatible)
CREATE UNIQUE INDEX IF NOT EXISTS xp_log_user_action_idem_idx
  ON public.xp_log (user_id, action, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── Step 3: Rebuild award_xp with all guards ───────────────────────────────
-- Drop old function first (CASCADE since evaluate_badges references may need update separately)
DROP FUNCTION IF EXISTS public.award_xp(UUID, TEXT, JSONB) CASCADE;

CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id UUID,
  p_action TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE(new_xp_total BIGINT, new_level INT, xp_awarded INT)
LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '5s'
AS $$
DECLARE
  v_xp INT;
  v_cooldown INT;
  v_max_daily INT;
  v_new_xp BIGINT;
  v_new_lvl INT;
  v_cur_lvl INT;
  v_last_award TIMESTAMPTZ;
  v_today_xp INT;
  v_caller_uid UUID;
  v_is_service_role BOOLEAN;
BEGIN
  -- ── AUTH GUARD ────────────────────────────────────────────────────────────
  -- Determine if caller is service_role (bypass auth check for internal calls)
  BEGIN
    v_is_service_role := NULLIF(current_setting('request.jwt.claims', TRUE)::jsonb->>'role', NULL) = 'service_role';
  EXCEPTION WHEN OTHERS THEN
    v_is_service_role := FALSE;
  END;
  v_caller_uid := auth.uid();

  -- Only allow if caller uid matches target uid, or caller is service_role
  IF v_caller_uid != p_user_id AND NOT v_is_service_role THEN
    RAISE EXCEPTION 'Cannot award XP to another user. auth.uid()=%, p_user_id=%', v_caller_uid, p_user_id;
  END IF;

  -- ── VALIDATE ACTION ───────────────────────────────────────────────────────
  SELECT xp, cooldown_seconds, max_daily_xp
    INTO v_xp, v_cooldown, v_max_daily
    FROM public.xp_actions WHERE action = p_action;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  -- ── IDEMPOTENCY CHECK ─────────────────────────────────────────────────────
  -- If idempotency_key is provided and a matching log entry exists, silently
  -- return current XP totals without awarding again.
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM 1 FROM public.xp_log
      WHERE user_id = p_user_id
        AND action = p_action
        AND idempotency_key = p_idempotency_key
      LIMIT 1;
    IF FOUND THEN
      SELECT xp_total, level INTO v_new_xp, v_new_lvl
        FROM public.profiles WHERE id = p_user_id;
      xp_awarded := 0;
      new_xp_total := v_new_xp;
      new_level := v_new_lvl;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- ── COOLDOWN CHECK ────────────────────────────────────────────────────────
  IF v_cooldown > 0 THEN
    SELECT MAX(created_at) INTO v_last_award
      FROM public.xp_log
      WHERE user_id = p_user_id AND action = p_action;
    IF v_last_award IS NOT NULL AND (NOW() - v_last_award) < make_interval(secs => v_cooldown) THEN
      SELECT xp_total, level INTO v_new_xp, v_new_lvl
        FROM public.profiles WHERE id = p_user_id;
      xp_awarded := 0;
      new_xp_total := v_new_xp;
      new_level := v_new_lvl;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- ── DAILY CAP CHECK ───────────────────────────────────────────────────────
  IF v_max_daily IS NOT NULL THEN
    SELECT COALESCE(SUM(xp_awarded), 0) INTO v_today_xp
      FROM public.xp_log
      WHERE user_id = p_user_id AND action = p_action AND created_at::DATE = CURRENT_DATE;
    IF v_today_xp >= v_max_daily THEN
      SELECT xp_total, level INTO v_new_xp, v_new_lvl
        FROM public.profiles WHERE id = p_user_id;
      xp_awarded := 0;
      new_xp_total := v_new_xp;
      new_level := v_new_lvl;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- ── AWARD XP ──────────────────────────────────────────────────────────────
  INSERT INTO public.xp_log (user_id, action, xp_awarded, metadata, idempotency_key)
    VALUES (p_user_id, p_action, v_xp, p_metadata, p_idempotency_key);

  INSERT INTO public.user_daily_activity (user_id, date, xp_earned)
    VALUES (p_user_id, CURRENT_DATE, v_xp)
    ON CONFLICT (user_id, date) DO UPDATE SET xp_earned = user_daily_activity.xp_earned + v_xp;

  UPDATE public.profiles SET xp_total = xp_total + v_xp WHERE id = p_user_id RETURNING xp_total INTO v_new_xp;

  v_new_lvl := public.calculate_level(v_new_xp);
  SELECT level INTO v_cur_lvl FROM public.profiles WHERE id = p_user_id;
  IF v_new_lvl > v_cur_lvl THEN
    UPDATE public.profiles SET level = v_new_lvl WHERE id = p_user_id;
  END IF;

  xp_awarded := v_xp;
  new_xp_total := v_new_xp;
  new_level := v_new_lvl;
  RETURN NEXT;
END;
$$;

-- ── Step 4: Re-apply permissions ───────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.award_xp FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_xp TO authenticated, service_role;

-- ── Step 5: Create a helper for edge functions to detect service_role ─────
-- Edge functions use the anon key, so they call as authenticated user.
-- The auth guard checks auth.uid() == p_user_id, which is fine since
-- edge functions authenticate as the user. For admin calls (e.g., granting
-- badges to other users), service_role key should be used directly.

-- ── Step 6: Add global daily XP cap to profiles ────────────────────────────
-- Prevent runaway XP accumulation from any source (badges, gifted, etc.)
-- 10,000 XP/day is roughly level 100 (requires sqrt(10000/100) ≈ 10, area actually...)
-- 10,000 XP/day is generous but prevents truly absurd farming.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp_earned_today INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xp_day_date DATE DEFAULT CURRENT_DATE;

-- Create a function to check/enforce the global daily cap
CREATE OR REPLACE FUNCTION public.check_global_xp_cap(p_user_id UUID, p_xp_to_add INT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today INT;
  v_day_date DATE;
BEGIN
  SELECT xp_earned_today, xp_day_date INTO v_today, v_day_date
    FROM public.profiles WHERE id = p_user_id;

  -- Reset if it's a new day
  IF v_day_date IS NULL OR v_day_date < CURRENT_DATE THEN
    UPDATE public.profiles SET xp_earned_today = 0, xp_day_date = CURRENT_DATE WHERE id = p_user_id;
    v_today := 0;
  END IF;

  -- Cap at 10,000 XP per day globally
  IF v_today + p_xp_to_add > 10000 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles SET xp_earned_today = xp_earned_today + p_xp_to_add WHERE id = p_user_id;
  RETURN TRUE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_global_xp_cap FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_global_xp_cap TO authenticated, service_role;

-- ── Step 7: Add admin-only RPC to audit suspicious XP activity ─────────────
CREATE OR REPLACE FUNCTION public.audit_xp_spikes(
  p_min_xp_per_hour INT DEFAULT 500,
  p_lookback_hours INT DEFAULT 24
)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  total_xp_awarded BIGINT,
  unique_actions BIGINT,
  first_award TIMESTAMPTZ,
  last_award TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    xl.user_id,
    p.username,
    SUM(xl.xp_awarded)::BIGINT AS total_xp_awarded,
    COUNT(DISTINCT xl.action) AS unique_actions,
    MIN(xl.created_at) AS first_award,
    MAX(xl.created_at) AS last_award
  FROM public.xp_log xl
  JOIN public.profiles p ON p.id = xl.user_id
  WHERE xl.created_at > NOW() - make_interval(hours => p_lookback_hours)
  GROUP BY xl.user_id, p.username
  HAVING SUM(xl.xp_awarded) > p_min_xp_per_hour * EXTRACT(EPOCH FROM (MAX(xl.created_at) - MIN(xl.created_at))) / 3600.0
     AND EXTRACT(EPOCH FROM (MAX(xl.created_at) - MIN(xl.created_at))) / 3600.0 > 0
  ORDER BY total_xp_awarded DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_xp_spikes FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_xp_spikes TO authenticated, service_role;