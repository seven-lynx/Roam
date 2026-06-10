-- =============================================================================
-- Push notification tokens for FCM (Android) and Web Push
-- =============================================================================
-- Stores device tokens so the push-notify Edge Function can deliver push
-- messages when a notification row is inserted.
-- =============================================================================

-- ── 1. push_tokens table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform    TEXT        NOT NULL CHECK (platform IN ('android', 'web')),
  token       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user
  ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens: owner can manage"
  ON push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);