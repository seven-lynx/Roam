-- =============================================================================
-- Route challenge completion rewards through the unified apply_xp() primitive.
-- =============================================================================
-- on_user_action_challenge() previously wrote xp_log + profiles directly
-- (manual xp_total increment + level recalc). This rewrites the reward path to
-- call apply_xp() so challenge rewards share the same idempotency, self-healing
-- SUM(xp_log) recalc, daily-activity bump, and level_up notification as every
-- other XP source. The challenge_complete notification is unchanged.
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
    -- Award XP through the unified primitive. apply_xp() re-derives xp_total
    -- from SUM(xp_log), recalculates the level, bumps daily activity, and emits
    -- a level_up notification when applicable.
    PERFORM public.apply_xp(
      NEW.user_id,
      'challenge_reward',
      completed.xp_reward,
      jsonb_build_object(
        'challenge_key',   completed.challenge_key,
        'challenge_title', completed.title,
        'instance_id',     completed.instance_id
      ),
      'challenge:' || completed.instance_id::text
    );

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
