-- beta_signups table — stores closed beta email signups from the landing page.
--
-- RLS policy: anyone may INSERT (anonymous or authenticated).
--             SELECT is intentionally blocked for all roles — the list is read
--             via the Supabase Dashboard table editor or Postgres client,
--             bypassing RLS entirely.

CREATE TABLE beta_signups (
  id          BIGINT       PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  email       text         NOT NULL UNIQUE
                           CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at  timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE beta_signups ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated users) can sign up.
CREATE POLICY "Anyone can sign up for beta"
  ON beta_signups
  FOR INSERT
  WITH CHECK (true);

-- No SELECT policy — use the Supabase Dashboard or Postgres client to read.

-- Index for retrieving signups sorted by recency.
CREATE INDEX beta_signups_created_at_idx ON beta_signups (created_at DESC);