-- =============================================================================
-- Notification preferences + RLS hardening
-- =============================================================================
-- 1. `notification_preferences` JSONB on user_settings — per-type push/email
--    channel toggles. Absent type or channel = enabled (opt-out only).
--    Shape: { "<type>": { "push": true, "email": true }, ... }
-- 2. Trigger restricting client UPDATEs on notifications to the `read` flag
--    only (users can currently rewrite title/body/data on their own rows).
-- =============================================================================

-- ── 1. Per-type notification preferences ──────────────────────────────────────
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 2. Restrict notifications UPDATE to the `read` flag ───────────────────────
CREATE OR REPLACE FUNCTION public.enforce_notifications_read_only_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Service-role calls (no JWT `sub`) bypass the restriction so maintenance and
  -- edge functions can still rewrite notification content if ever needed.
  IF current_setting('request.jwt.claim.sub', true) IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.data IS DISTINCT FROM OLD.data
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Notifications can only be marked read or unread';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_notifications_read_only_update ON public.notifications;
CREATE TRIGGER trg_enforce_notifications_read_only_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_notifications_read_only_update();
