-- Migration: user_actions table + trigger for challenge progress
-- Replaces direct incrementChallengeProgress() calls in edge functions
-- with a centralized user_actions log + Postgres trigger.
--
-- Every user action (roam, rate, save, follow, submit, collection, share, report)
-- inserts one row into user_actions. A BEFORE INSERT trigger calls
-- increment_challenge_progress() to update challenge counters in real-time.

-- ── Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_actions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,  -- 'roam', 'rate', 'save', 'follow', 'submit', 'collection', 'share', 'report'
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for fast per-user lookups (challenge evaluation, activity feed)
CREATE INDEX IF NOT EXISTS idx_user_actions_user_created
  ON public.user_actions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_actions_type
  ON public.user_actions(action_type);

-- Enable RLS
ALTER TABLE public.user_actions ENABLE ROW LEVEL SECURITY;

-- Users can read their own actions
CREATE POLICY "Users can read own actions"
  ON public.user_actions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can insert (edge functions use service_role key)
CREATE POLICY "Service role can insert actions"
  ON public.user_actions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ── Trigger function ───────────────────────────────────────────────────────

-- Maps action_type to challenge condition_type (action_type + '_count')
-- and calls incrementChallengeProgress for the user.
--
-- Condition types covered:
--   roam       → roam_count
--   rate       → rate_count
--   save       → save_count
--   follow     → follow_count
--   submit     → submit_count
--   collection → collection_count
--   share      → share_count
--   report     → report_count
--
-- Note: category_count, domain_count, subcategory_count, and session_count
-- challenges are not tracked via user_actions. They require aggregating
-- distinct values (e.g., unique categories visited) which is handled
-- separately by evaluate-badges or a future cron function.

CREATE OR REPLACE FUNCTION public.on_user_action_challenge()
RETURNS TRIGGER AS $$
DECLARE
  challenge_condition TEXT;
BEGIN
  -- Map action_type to condition_type
  challenge_condition := NEW.action_type || '_count';

  -- Update challenge progress for matching active, uncompleted challenges
  UPDATE public.user_challenges uc
  SET
    progress_current = LEAST(uc.progress_current + 1, c.goal_count),
    completed_at = CASE
      WHEN uc.progress_current + 1 >= c.goal_count THEN now()
      ELSE uc.completed_at
    END
  FROM public.challenge_instances ci
  JOIN public.challenges c ON c.id = ci.challenge_id
  WHERE uc.instance_id = ci.id
    AND uc.user_id = NEW.user_id
    AND uc.completed_at IS NULL
    AND ci.expires_at > now()
    AND c.condition_type = challenge_condition
    -- Respect time restrictions
    AND (
      c.time_restriction IS NULL
      OR (c.time_restriction = 'weekend' AND EXTRACT(DOW FROM now()) IN (0, 6))
      OR (c.time_restriction = 'morning' AND EXTRACT(HOUR FROM now()) BETWEEN 10 AND 13)
      OR (c.time_restriction = 'afternoon' AND EXTRACT(HOUR FROM now()) BETWEEN 16 AND 19)
      OR (c.time_restriction = 'evening' AND EXTRACT(HOUR FROM now()) BETWEEN 20 AND 23)
      OR (c.time_restriction = 'night' AND EXTRACT(HOUR FROM now()) < 5)
    );

  -- Award XP and notify for newly completed challenges
  -- This is handled here or by the edge function calling incrementChallengeProgress.
  -- For simplicity, we handle completion detection in the trigger, but XP/notifications
  -- are done via the existing incrementChallengeProgress edge-function utility
  -- which can be called separately (e.g., by a cron or the edge function after insert).
  --
  -- The trigger handles the real-time counter update. Completion rewards (XP, notifications)
  -- are handled in the edge function after the insert succeeds, using the existing
  -- incrementChallengeProgress shared utility which now also handles completion.

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS user_action_challenge_trigger ON public.user_actions;
CREATE TRIGGER user_action_challenge_trigger
  BEFORE INSERT ON public.user_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_user_action_challenge();