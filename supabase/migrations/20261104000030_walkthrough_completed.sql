-- Scripted onboarding walkthrough gate.
--
-- New signups must complete the full walkthrough (theme -> interests ->
-- username -> public -> first Roam) before reaching the app. Existing accounts
-- are marked complete on this migration so they skip it.

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS walkthrough_completed_at timestamptz;

UPDATE profiles
   SET walkthrough_completed_at = created_at
 WHERE walkthrough_completed_at IS NULL;
