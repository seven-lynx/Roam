-- =============================================================================
-- Challenge system fixes: single source of truth for completion rewards
-- =============================================================================
-- Problem: challenge completion rewards (XP + notification) were split across
-- three mechanisms that never composed correctly:
--   1. on_user_action_challenge() trigger only bumped progress and set
--      completed_at but never awarded XP/notifications.
--   2. incrementChallengeProgress() edge-function utility awarded XP but was
--      only called by the collection add_item action.
--   3. evaluate-badges awarded XP but only for rows where completed_at IS NULL,
--      so challenges already completed by the trigger were always skipped.
-- Net effect: almost every completed challenge never paid out XP.
--
-- Fix: make on_user_action_challenge() the single authority. It now increments
-- progress, marks completion, awards XP, updates the profile XP total/level,
-- and inserts the challenge_complete notification -- all atomically in the same
-- transaction as the triggering user_actions insert. The completed_xp_awarded
-- flag is set TRUE to record that the reward was paid.
--
-- SECURITY DEFINER is required because the trigger writes xp_log, profiles and
-- notifications, none of which grant INSERT/UPDATE to regular authenticated
-- users via RLS. The function is RETURNS TRIGGER and takes no arguments, so it
-- cannot be meaningfully invoked by clients.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS user_action_challenge_trigger ON public.user_actions;
--   DROP FUNCTION IF EXISTS public.on_user_action_challenge();
--   -- then restore the previous definition from
--   -- 20260806000000_user_actions.sql (progress-only version).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.on_user_action_challenge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  challenge_condition TEXT;
  completed RECORD;
BEGIN
  challenge_condition := NEW.action_type || '_count';

  -- Increment progress for every matching active, uncompleted challenge and
  -- capture the ones that just reached their goal. The `completed_at IS NULL`
  -- guard is what makes completion (and therefore the reward below) idempotent:
  -- once a challenge is completed it is never matched again.
  FOR completed IN
    WITH incremented AS (
      UPDATE public.user_challenges uc
      SET
        progress_current = LEAST(uc.progress_current + 1, c.goal_count),
        completed_at = CASE
          WHEN uc.progress_current + 1 >= c.goal_count THEN now()
          ELSE NULL
        END
      FROM public.challenge_instances ci
      JOIN public.challenges c ON c.id = ci.challenge_id
      WHERE uc.instance_id = ci.id
        AND uc.user_id = NEW.user_id
        AND uc.completed_at IS NULL
        AND ci.expires_at > now()
        AND c.condition_type = challenge_condition
        -- Time-restriction windows, in UTC. Single source of truth for the
        -- challenge catalog; keep in sync with the seed rows' goal text.
        AND (
          c.time_restriction IS NULL
          OR (c.time_restriction = 'weekend'   AND EXTRACT(DOW  FROM now()) IN (0, 6))
          OR (c.time_restriction = 'morning'   AND EXTRACT(HOUR FROM now()) BETWEEN 10 AND 13)
          OR (c.time_restriction = 'afternoon' AND EXTRACT(HOUR FROM now()) BETWEEN 16 AND 19)
          OR (c.time_restriction = 'evening'   AND EXTRACT(HOUR FROM now()) BETWEEN 20 AND 23)
          OR (c.time_restriction = 'night'     AND EXTRACT(HOUR FROM now()) < 5)
        )
      RETURNING
        uc.instance_id,
        uc.completed_at,
        c.id            AS challenge_id,
        c.challenge_key AS challenge_key,
        c.title         AS title,
        c.xp_reward     AS xp_reward
    )
    SELECT * FROM incremented WHERE completed_at IS NOT NULL
  LOOP
    -- Award XP.
    INSERT INTO public.xp_log (user_id, action, xp_awarded, metadata)
    VALUES (
      NEW.user_id,
      'challenge_reward',
      completed.xp_reward,
      jsonb_build_object(
        'challenge_key',   completed.challenge_key,
        'challenge_title', completed.title,
        'instance_id',     completed.instance_id
      )
    );

    -- Update the profile's running XP total, then re-derive the level.
    UPDATE public.profiles
      SET xp_total = COALESCE(xp_total, 0) + completed.xp_reward
      WHERE id = NEW.user_id;

    UPDATE public.profiles
      SET level = public.calculate_level(xp_total)
      WHERE id = NEW.user_id;

    -- Record that the reward was paid.
    UPDATE public.user_challenges
      SET completed_xp_awarded = TRUE
      WHERE user_id = NEW.user_id
        AND instance_id = completed.instance_id;

    -- Notify the user.
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      'challenge_complete',
      'Challenge Complete: ' || completed.title || '!',
      '+' || completed.xp_reward || ' XP earned',
      jsonb_build_object(
        'challenge_key', completed.challenge_key,
        'xp',             completed.xp_reward
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.on_user_action_challenge() FROM PUBLIC;

-- =============================================================================
-- Backfill: award XP for challenge completions that never received a reward.
-- =============================================================================
-- Before this fix, challenges completed via the user_actions trigger had
-- completed_at set but never received XP or a notification, and the
-- completed_xp_awarded flag was never maintained by the legacy paths. This
-- block repairs the XP economy (profiles.xp_total == SUM(xp_log)) for those
-- completions.
--
-- Safety: the only legacy xp_log rows with action = 'challenge_reward' were
-- written by incrementChallengeProgress(), which was invoked exclusively for
-- condition_type = 'collection_count' and recorded only challenge_key (no
-- instance_id). For every other condition type there are no legacy reward rows,
-- so an instance_id match is precise and avoids double-awarding repeated
-- challenges (e.g. a daily challenge completed on multiple days). For
-- collection_count we conservatively match on challenge_key, which can only
-- under-award in the rare case of multiple same-key completions -- never double.
--
-- Notifications are intentionally NOT backfilled to avoid spamming users about
-- challenges they completed long ago.
-- =============================================================================
DO $$
DECLARE
  r RECORD;
  v_exists BOOLEAN;
BEGIN
  FOR r IN
    SELECT
      uc.user_id,
      uc.instance_id,
      c.challenge_key,
      c.condition_type,
      c.title,
      c.xp_reward
    FROM public.user_challenges uc
    JOIN public.challenge_instances ci ON ci.id = uc.instance_id
    JOIN public.challenges c ON c.id = ci.challenge_id
    WHERE uc.completed_at IS NOT NULL
      AND uc.completed_xp_awarded IS FALSE
  LOOP
    -- Determine whether a reward was already paid for this completion.
    IF r.condition_type = 'collection_count' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.xp_log xl
        WHERE xl.user_id = r.user_id
          AND xl.action = 'challenge_reward'
          AND xl.metadata->>'challenge_key' = r.challenge_key
      ) INTO v_exists;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.xp_log xl
        WHERE xl.user_id = r.user_id
          AND xl.action = 'challenge_reward'
          AND xl.metadata->>'instance_id' = r.instance_id::text
      ) INTO v_exists;
    END IF;

    IF v_exists THEN
      -- Already paid by a legacy path; just mark it so we never revisit.
      UPDATE public.user_challenges
        SET completed_xp_awarded = TRUE
        WHERE user_id = r.user_id AND instance_id = r.instance_id;
      CONTINUE;
    END IF;

    -- Award the missing reward.
    INSERT INTO public.xp_log (user_id, action, xp_awarded, metadata)
    VALUES (
      r.user_id,
      'challenge_reward',
      r.xp_reward,
      jsonb_build_object(
        'challenge_key',   r.challenge_key,
        'challenge_title', r.title,
        'instance_id',     r.instance_id,
        'backfilled',      TRUE
      )
    );

    UPDATE public.profiles
      SET xp_total = COALESCE(xp_total, 0) + r.xp_reward
      WHERE id = r.user_id;

    UPDATE public.profiles
      SET level = public.calculate_level(xp_total)
      WHERE id = r.user_id;

    UPDATE public.user_challenges
      SET completed_xp_awarded = TRUE
      WHERE user_id = r.user_id AND instance_id = r.instance_id;
  END LOOP;
END;
$$;
