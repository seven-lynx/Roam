-- =============================================================================
-- Challenge auto-population: on-demand seeding + one-time backfill
-- =============================================================================
-- The `challenges` edge function is read-only; challenge rows were only created
-- by cron-daily-challenges (scheduled externally) or a manual seed script. If the
-- schedule was never configured, or a user signs up between nightly runs, they
-- see "No active challenges."
--
-- This adds an idempotent, on-demand seeder. The `challenges` edge function calls
-- ensure_user_challenges() before reading, and a backfill block seeds every
-- existing profile immediately.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.ensure_user_challenges();
--   DROP FUNCTION IF EXISTS public.seed_challenges_for_user(UUID);
-- =============================================================================

CREATE OR REPLACE FUNCTION public.seed_challenges_for_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily_count   INT;
  v_weekly_count  INT;
  v_monthly_count INT;
  v_inst_id       UUID;
  v_ch            RECORD;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN;
  END IF;

  -- Serialize concurrent seeders so global instances are never created twice.
  PERFORM pg_advisory_xact_lock(hashtext('roam_challenge_seed')::bigint);

  -- Drop this user's expired assignments.
  DELETE FROM public.user_challenges uc
  USING public.challenge_instances ci
  WHERE ci.id = uc.instance_id AND uc.user_id = p_user_id AND ci.expires_at <= now();

  -- ── Daily ─────────────────────────────────────────────────────────────
  SELECT count(*) INTO v_daily_count
  FROM public.user_challenges uc
  JOIN public.challenge_instances ci ON ci.id = uc.instance_id
  WHERE uc.user_id = p_user_id AND ci.challenge_type = 'daily' AND ci.expires_at > now();

  IF v_daily_count = 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.challenge_instances
      WHERE challenge_type = 'daily' AND is_global = true AND expires_at > now()
    ) THEN
      FOR v_ch IN SELECT id FROM public.challenges WHERE challenge_type = 'daily' LOOP
        INSERT INTO public.challenge_instances (challenge_id, challenge_type, starts_at, expires_at, is_global)
        VALUES (v_ch.id, 'daily', date_trunc('day', now()), date_trunc('day', now()) + INTERVAL '1 day', true);
      END LOOP;
    END IF;

    FOR v_inst_id IN
      SELECT id FROM public.challenge_instances
      WHERE challenge_type = 'daily' AND is_global = true AND expires_at > now()
      ORDER BY random()
      LIMIT (1 + floor(random() * 3)::int)
    LOOP
      INSERT INTO public.user_challenges (user_id, instance_id, progress_current)
      VALUES (p_user_id, v_inst_id, 0) ON CONFLICT (user_id, instance_id) DO NOTHING;
    END LOOP;
  END IF;

  -- ── Weekly ────────────────────────────────────────────────────────────
  SELECT count(*) INTO v_weekly_count
  FROM public.user_challenges uc
  JOIN public.challenge_instances ci ON ci.id = uc.instance_id
  WHERE uc.user_id = p_user_id AND ci.challenge_type = 'weekly' AND ci.expires_at > now();

  IF v_weekly_count = 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.challenge_instances
      WHERE challenge_type = 'weekly' AND is_global = true AND expires_at > now()
    ) THEN
      FOR v_ch IN
        SELECT id FROM public.challenges WHERE challenge_type = 'weekly' ORDER BY random() LIMIT 5
      LOOP
        INSERT INTO public.challenge_instances (challenge_id, challenge_type, starts_at, expires_at, is_global)
        VALUES (v_ch.id, 'weekly', date_trunc('week', now()), date_trunc('week', now()) + INTERVAL '7 days', true);
      END LOOP;
    END IF;

    FOR v_inst_id IN
      SELECT id FROM public.challenge_instances
      WHERE challenge_type = 'weekly' AND is_global = true AND expires_at > now()
    LOOP
      INSERT INTO public.user_challenges (user_id, instance_id, progress_current)
      VALUES (p_user_id, v_inst_id, 0) ON CONFLICT (user_id, instance_id) DO NOTHING;
    END LOOP;
  END IF;

  -- ── Monthly ───────────────────────────────────────────────────────────
  SELECT count(*) INTO v_monthly_count
  FROM public.user_challenges uc
  JOIN public.challenge_instances ci ON ci.id = uc.instance_id
  WHERE uc.user_id = p_user_id AND ci.challenge_type = 'monthly' AND ci.expires_at > now();

  IF v_monthly_count = 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.challenge_instances
      WHERE challenge_type = 'monthly' AND is_global = true AND expires_at > now()
    ) THEN
      FOR v_ch IN
        SELECT id FROM public.challenges WHERE challenge_type = 'monthly' ORDER BY random() LIMIT 6
      LOOP
        INSERT INTO public.challenge_instances (challenge_id, challenge_type, starts_at, expires_at, is_global)
        VALUES (v_ch.id, 'monthly', date_trunc('month', now()), date_trunc('month', now()) + INTERVAL '1 month', true);
      END LOOP;
    END IF;

    FOR v_inst_id IN
      SELECT id FROM public.challenge_instances
      WHERE challenge_type = 'monthly' AND is_global = true AND expires_at > now()
    LOOP
      INSERT INTO public.user_challenges (user_id, instance_id, progress_current)
      VALUES (p_user_id, v_inst_id, 0) ON CONFLICT (user_id, instance_id) DO NOTHING;
    END LOOP;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_challenges_for_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_challenges_for_user(UUID) TO service_role;

-- On-demand entry point: seeds the authenticated caller via auth.uid().
CREATE OR REPLACE FUNCTION public.ensure_user_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.seed_challenges_for_user(auth.uid());
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_user_challenges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_challenges() TO authenticated, service_role;

-- ── One-time backfill for existing profiles ──────────────────────────────
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT id FROM public.profiles LOOP
    PERFORM public.seed_challenges_for_user(p.id);
  END LOOP;
END;
$$;
