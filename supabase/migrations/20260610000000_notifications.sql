-- =============================================================================
-- In-app notifications system
-- =============================================================================
-- Adds:
--   1. notifications table — stores user notifications (url_approved, url_rejected, etc.)
--   2. Trigger on moderation_queue — inserts a notification when status changes
--      from 'pending' → 'approved' or 'rejected'
-- =============================================================================

-- ── 1. notifications table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('url_approved', 'url_rejected', 'new_follower')),
  title       TEXT        NOT NULL,
  body        TEXT,
  data        JSONB       DEFAULT '{}',
  read        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fetching unread notifications per user (most common query)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read = FALSE;

-- ── 2. RLS policies ─────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "notifications: owner can read"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
CREATE POLICY "notifications: owner can update read"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "notifications: owner can delete"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- No INSERT policy — notifications are created by the trigger below (SECURITY DEFINER)

-- ── 3. Trigger: notify on moderation decision ────────────────────────────────
-- Fires when moderation_queue.status changes from 'pending' to 'approved' or
-- 'rejected'. Inserts a notification for the submitter.
CREATE OR REPLACE FUNCTION public.notify_on_moderation_decision()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.submitted_by,
      CASE WHEN NEW.status = 'approved' THEN 'url_approved' ELSE 'url_rejected' END,
      CASE WHEN NEW.status = 'approved' THEN 'URL approved!' ELSE 'URL not approved' END,
      CASE
        WHEN NEW.status = 'approved' THEN 'Your submission "' || COALESCE(NULLIF(NEW.title, ''), NEW.url) || '" was approved and is now in the catalog.'
        ELSE 'Your submission "' || COALESCE(NULLIF(NEW.title, ''), NEW.url) || '" was not approved.'
      END,
      jsonb_build_object(
        'url', NEW.url,
        'queue_id', NEW.id,
        'title', NEW.title
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_moderation_decision ON public.moderation_queue;
CREATE TRIGGER trg_notify_moderation_decision
  AFTER UPDATE OF status ON public.moderation_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_moderation_decision();