-- feedback table — stores user-submitted feedback and bug reports from
-- all platforms (web, extension, Android).
--
-- RLS policy: anyone may INSERT (authenticated or anonymous).
--             SELECT is intentionally blocked for all roles — feedback is
--             read via the service role key in the admin Edge Function,
--             which bypasses RLS entirely.

CREATE TABLE feedback (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  platform    text        NOT NULL
                          CHECK (platform IN ('web', 'extension-chrome', 'extension-firefox', 'android')),
  message     text        NOT NULL
                          CHECK (char_length(message) BETWEEN 1 AND 2000),
  email       text        CHECK (
                            email IS NULL OR
                            email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
                          ),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated users) can submit feedback.
CREATE POLICY "Anyone can submit feedback"
  ON feedback
  FOR INSERT
  WITH CHECK (true);

-- No SELECT policy — only the service role (used by Edge Functions) can read.

-- Index for admin queries sorted by recency.
CREATE INDEX feedback_created_at_idx ON feedback (created_at DESC);
