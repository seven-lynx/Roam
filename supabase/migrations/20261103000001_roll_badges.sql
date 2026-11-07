-- =============================================================================
-- Cyberdeck Roll gallery badges + canonical action types
-- =============================================================================
-- The in-OS "Cyberdeck Roll" program (web) records two primary actions:
--   * wallpaper   — set a photo as the desktop wallpaper
--   * roll_rate   — "like" a photo
-- These are logged to user_actions (the existing audit log + challenge trigger)
-- and evaluated by the evaluate-badges edge function, which unlocks the two
-- badges seeded below and pays out their XP rewards.
-- =============================================================================

-- 1. Widen the canonical action_type allow-list to include the two roll actions.
ALTER TABLE public.user_actions
  DROP CONSTRAINT IF EXISTS user_actions_action_type_valid;

ALTER TABLE public.user_actions
  ADD CONSTRAINT user_actions_action_type_valid
  CHECK (action_type IN (
    'roam', 'rate', 'save', 'follow', 'submit',
    'collection', 'share', 'report', 'wallpaper', 'roll_rate'
  ));

-- 2. Match the authenticated INSERT policy to the widened set.
DROP POLICY IF EXISTS "Authenticated users can insert own actions" ON public.user_actions;

CREATE POLICY "Authenticated users can insert own actions"
  ON public.user_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND action_type IN (
      'roam', 'rate', 'save', 'follow', 'submit',
      'collection', 'share', 'report', 'wallpaper', 'roll_rate'
    )
  );

-- 3. Seed the two roll badges (idempotent).
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward)
VALUES
  ('roll-wallpaper', 'Decked Out', 'Set a photo from the Cyberdeck Roll as your desktop wallpaper', '🖥️', 'engagement', 1, 1, 25),
  ('roll-rate-5', 'Photo Critic', 'Like 5 photos in the Cyberdeck Roll', '📸', 'engagement', 1, 5, 25)
ON CONFLICT (slug) DO NOTHING;
