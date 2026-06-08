-- =============================================================================
-- Email notification system
-- =============================================================================
-- Adds:
--   1. email_notifications column to user_settings (referenced by settings UI)
--   2. email_log table — audit log of every bulk email send
-- =============================================================================

-- ── 1. Add email_notifications to user_settings ─────────────────────────────
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 2. email_log table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject         TEXT        NOT NULL,
  body_md         TEXT        NOT NULL,
  recipient_count INTEGER     NOT NULL DEFAULT 0,
  success_count   INTEGER     NOT NULL DEFAULT 0,
  fail_count      INTEGER     NOT NULL DEFAULT 0,
  sent_by         UUID        NOT NULL,
  sender_type     TEXT        NOT NULL DEFAULT 'manual',
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin-only access via service role (no RLS on this table — accessed via
-- server actions / Edge Functions with service role key).
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_log: admin access only"
  ON email_log FOR ALL
  USING (false);  -- block direct client access; server actions use service role