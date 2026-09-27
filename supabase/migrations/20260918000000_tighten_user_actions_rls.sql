-- Migration: Tighten user_actions RLS to prevent self-crediting arbitrary actions
--
-- The original policy `Authenticated users can insert own actions` accepted any
-- action_type value. A client could self-credit `roam_count`, `submit_count`,
-- etc., farming XP and bypassing the entire challenge/badge economy.
--
-- This migration:
--   1. Adds a CHECK constraint on action_type (server-side enforcement).
--   2. Replaces the open INSERT policy with one that requires the action_type
--      to match a known set.
--   3. Adds a server-side rate limit via a daily-count trigger that prevents
--      more than 200 roam/save/rate inserts per user per day.
--
-- The set of allowed action_types is the canonical set: roam, rate, save,
-- follow, submit, collection, share, report.

-- ΓöÇΓöÇΓöÇ 1. CHECK constraint on action_type ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_actions_action_type_valid'
  ) THEN
    ALTER TABLE public.user_actions
      ADD CONSTRAINT user_actions_action_type_valid
      CHECK (action_type IN (
        'roam', 'rate', 'save', 'follow', 'submit',
        'collection', 'share', 'report'
      ));
  END IF;
END $$;

-- ΓöÇΓöÇΓöÇ 2. Replace the open INSERT policy ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
-- Drop the broad "Authenticated users can insert own actions" policy and
-- replace it with one that constrains action_type to the canonical set.
-- Trigger writes go through the same gate because the trigger context is
-- the inserting user (auth.uid() = user_id).
DROP POLICY IF EXISTS "Authenticated users can insert own actions" ON public.user_actions;

CREATE POLICY "Authenticated users can insert own actions"
  ON public.user_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND action_type IN (
      'roam', 'rate', 'save', 'follow', 'submit',
      'collection', 'share', 'report'
    )
  );

-- ΓöÇΓöÇΓöÇ 3. Per-user daily rate limit ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
-- Cap each user at 200 insertable actions per UTC day for the high-frequency
-- action_types. Anything beyond this is rejected by trigger.
CREATE OR REPLACE FUNCTION public.enforce_user_actions_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  today_count INT;
BEGIN
  SELECT count(*) INTO today_count
  FROM public.user_actions
  WHERE user_id = NEW.user_id
    AND created_at >= date_trunc('day', now())
    AND action_type IN ('roam', 'rate', 'save');

  IF today_count >= 200 THEN
    RAISE EXCEPTION 'user_actions rate limit exceeded (200/day for roam/rate/save) for user %', NEW.user_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_actions_rate_limit_trigger ON public.user_actions;
CREATE TRIGGER user_actions_rate_limit_trigger
  BEFORE INSERT ON public.user_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_actions_rate_limit();

-- ΓöÇΓöÇΓöÇ 4. Documentation comment ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
COMMENT ON TABLE public.user_actions IS
  'Audit log of user actions. INSERT is restricted to authenticated users inserting their own rows with a constrained action_type and capped at 200 high-frequency actions per UTC day. Service-role writes are unrestricted.';
COMMENT ON POLICY "Authenticated users can insert own actions" ON public.user_actions IS
  'Inserts require auth.uid() = user_id AND action_type in canonical set.';