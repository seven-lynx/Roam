-- ============================================================================
-- Unify the XP + badge systems: single Roam XP economy, single evaluator.
-- ============================================================================
-- Collapses the two parallel XP paths (award_xp + award_game_xp) into ONE
-- primitive, apply_xp(), and makes award_xp a thin fixed-lookup wrapper.
-- Games award ordinary Roam XP through the same ledger (action strings stay
-- `game:<id>:<kind>` for badge evaluation).
-- ============================================================================

-- ── 1. Category taxonomy: engagement -> curiosity, add games ────────────────
ALTER TABLE public.badges DROP CONSTRAINT IF EXISTS badges_category_check;

-- Convert existing rows BEFORE re-adding the tighter CHECK, otherwise the new
-- constraint would fail to validate the legacy 'engagement' rows.
UPDATE public.badges SET category = 'curiosity' WHERE category = 'engagement';

ALTER TABLE public.badges
  ADD CONSTRAINT badges_category_check
  CHECK (category IN (
    'exploration','collecting','curating','social','streaks',
    'contributing','curiosity','games','secret','milestone','gift'
  ));

-- ── 1b. Widen the user_actions allow-list to include game events ────────────
ALTER TABLE public.user_actions DROP CONSTRAINT IF EXISTS user_actions_action_type_valid;
ALTER TABLE public.user_actions
  ADD CONSTRAINT user_actions_action_type_valid
  CHECK (action_type IN (
    'roam','rate','save','follow','submit',
    'collection','share','report','wallpaper','roll_rate','game'
  ));

-- ── 2. Seed the game-win badges (idempotent) ────────────────────────────────
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward)
VALUES
  ('win-relay',     'Signal Found',       'Beat RELAY',             '📡', 'games', 1, 1, 50),
  ('win-botfield',  'Field Cleared',      'Clear a BOTFIELD board', '💣', 'games', 1, 1, 50),
  ('win-compiler',  'Clean Build',        'Beat COMPILER',          '🔧', 'games', 1, 1, 50),
  ('win-debris',    'Sector Cleared',     'Beat DEBRIS',            '🪐', 'games', 1, 1, 50),
  ('win-firewalk',  'Perimeter Crossed',  'Beat FIREWALK',          '🔥', 'games', 1, 1, 50),
  ('win-underweb',  'Gems Recovered',     'Complete UNDERWEB',      '🕸️', 'games', 1, 1, 50),
  ('win-substrate', 'Treasures Recovered','Complete SUBSTRATE',     '🏆', 'games', 1, 1, 50)
ON CONFLICT (slug) DO NOTHING;

-- ── 3. apply_xp(): the single XP primitive ──────────────────────────────────
-- Idempotent (1-hour window on idempotency_key) and self-healing (re-derives
-- xp_total from SUM(xp_log) and level from calculate_level on every award).
CREATE OR REPLACE FUNCTION public.apply_xp(
  p_user_id           UUID,
  p_action            TEXT,
  p_xp                INT,
  p_metadata          JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key   TEXT DEFAULT NULL
)
RETURNS TABLE(new_xp_total BIGINT, new_level INT, xp_awarded INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '3s'
AS $$
DECLARE
  v_xp          INT;
  v_new_xp      BIGINT;
  v_new_lvl     INT;
  v_cur_lvl     INT;
  v_username    TEXT;
  v_profile_url TEXT;
BEGIN
  -- Clamp the award: never negative, and a single call is capped so a runaway
  -- score can't mint unbounded XP in one shot.
  v_xp := GREATEST(1, LEAST(p_xp, 1000));

  -- ── Idempotency check ──────────────────────────────────────────────────
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.xp_log
      WHERE user_id = p_user_id
        AND idempotency_key = p_idempotency_key
        AND created_at > now() - INTERVAL '1 hour'
    ) THEN
      SELECT xp_total, public.calculate_level(xp_total)
        INTO v_new_xp, v_new_lvl
        FROM public.profiles WHERE id = p_user_id;
      xp_awarded   := 0;  -- zero means "idempotent — already awarded"
      new_xp_total := v_new_xp;
      new_level    := v_new_lvl;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- Capture the previous level for the level-up notification.
  SELECT level, username INTO v_cur_lvl, v_username
    FROM public.profiles WHERE id = p_user_id;

  INSERT INTO public.xp_log (user_id, action, xp_awarded, metadata, idempotency_key)
  VALUES (p_user_id, p_action, v_xp, p_metadata, p_idempotency_key);

  INSERT INTO public.user_daily_activity (user_id, date, xp_earned)
  VALUES (p_user_id, CURRENT_DATE, v_xp)
  ON CONFLICT (user_id, date)
  DO UPDATE SET xp_earned = user_daily_activity.xp_earned + v_xp;

  -- Self-healing: re-derive the total from the ledger and level from that total.
  SELECT COALESCE(SUM(xp_awarded), 0) INTO v_new_xp
    FROM public.xp_log WHERE user_id = p_user_id;
  v_new_lvl := public.calculate_level(v_new_xp);

  UPDATE public.profiles
    SET xp_total = v_new_xp,
        level    = v_new_lvl
  WHERE id = p_user_id;

  IF v_new_lvl > v_cur_lvl THEN
    v_profile_url := 'https://roamtheweb.app/u/' || v_username;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      p_user_id,
      'level_up',
      '🎉 Level Up! You''re now Level ' || v_new_lvl,
      'Keep roaming to earn more badges and XP!',
      jsonb_build_object(
        'level', v_new_lvl,
        'rank',  '',
        'url',   v_profile_url
      )
    );
  END IF;

  xp_awarded   := v_xp;
  new_xp_total := v_new_xp;
  new_level    := v_new_lvl;
  RETURN NEXT;
END;
$$;

-- Variable XP is only mintable by trusted callers (edge functions / service role).
REVOKE EXECUTE ON FUNCTION public.apply_xp(UUID, TEXT, INT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_xp(UUID, TEXT, INT, JSONB, TEXT) TO service_role;

-- ── 4. award_xp(): fixed-lookup wrapper over apply_xp() ─────────────────────
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id           UUID,
  p_action            TEXT,
  p_metadata          JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key   TEXT DEFAULT NULL
)
RETURNS TABLE(new_xp_total BIGINT, new_level INT, xp_awarded INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '3s'
AS $$
DECLARE
  v_xp INT;
BEGIN
  SELECT xp INTO v_xp FROM public.xp_actions WHERE action = p_action;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;
  RETURN QUERY SELECT * FROM public.apply_xp(p_user_id, p_action, v_xp, p_metadata, p_idempotency_key);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_xp(UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.award_xp(UUID, TEXT, JSONB, TEXT) TO authenticated, service_role;

-- ── 5. Retire the separate game XP function ─────────────────────────────────
DROP FUNCTION IF EXISTS public.award_game_xp(UUID, TEXT, INT, JSONB, TEXT);

-- ── 6. grant_badge(): re-created over apply_xp() ────────────────────────────
-- Same contract as before (badge_unlocked + level_up notifications, badge_count
-- bump), but the XP write now flows through the unified primitive.
CREATE OR REPLACE FUNCTION public.grant_badge(
  p_user_id    UUID,
  p_badge_slug TEXT,
  p_granted_by UUID
)
RETURNS TABLE(
  badge_id         UUID,
  badge_slug       TEXT,
  badge_name       TEXT,
  badge_icon       TEXT,
  badge_category   TEXT,
  badge_xp_reward  INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_badge       RECORD;
  v_username    TEXT;
  v_profile_url TEXT;
BEGIN
  SELECT * INTO v_badge FROM public.badges WHERE slug = p_badge_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Badge not found: %', p_badge_slug;
  END IF;

  INSERT INTO public.user_badges (user_id, badge_id, granted_by, progress_current)
  VALUES (p_user_id, v_badge.id, p_granted_by, 0)
  ON CONFLICT DO NOTHING;

  IF FOUND THEN
    SELECT username INTO v_username FROM public.profiles WHERE id = p_user_id;
    v_profile_url := 'https://roamtheweb.app/u/' || v_username;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      p_user_id,
      'badge_unlocked',
      v_badge.icon || ' Badge Unlocked: ' || v_badge.name,
      v_badge.description,
      jsonb_build_object(
        'badge_slug', v_badge.slug,
        'badge_icon', v_badge.icon,
        'badge_name', v_badge.name,
        'xp_reward',  v_badge.xp_reward,
        'url',        v_profile_url
      )
    );

    IF v_badge.xp_reward > 0 THEN
      PERFORM public.apply_xp(
        p_user_id,
        'badge_gifted',
        v_badge.xp_reward,
        jsonb_build_object('badge_slug', p_badge_slug, 'granted_by', p_granted_by),
        NULL
      );
    END IF;

    UPDATE public.profiles SET badge_count = badge_count + 1 WHERE id = p_user_id;

    badge_id        := v_badge.id;
    badge_slug      := v_badge.slug;
    badge_name      := v_badge.name;
    badge_icon      := v_badge.icon;
    badge_category  := v_badge.category;
    badge_xp_reward := v_badge.xp_reward;
    RETURN NEXT;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_badge(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.grant_badge(UUID, TEXT, UUID) TO authenticated, service_role;

-- ── 7. Drop the legacy SQL evaluator (edge function is canonical) ───────────
DROP FUNCTION IF EXISTS public.evaluate_badges(UUID) CASCADE;



