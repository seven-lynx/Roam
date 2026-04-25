-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: schema improvements
-- Date: 2026-04-24
-- Tasks: 2.9b, 2.15a, 2.15b, 4.23a
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Task 2.9b — Missing FK indexes ───────────────────────────────────────────
-- collection_items(url_id): "all collections containing URL X" lookup
CREATE INDEX IF NOT EXISTS idx_collection_items_url_id
  ON collection_items (url_id);

-- follows(follower_id): "who is this user following?" lookup
CREATE INDEX IF NOT EXISTS idx_follows_follower_id
  ON follows (follower_id);

-- follows(following_id): "who follows this user?" lookup
CREATE INDEX IF NOT EXISTS idx_follows_following_id
  ON follows (following_id);


-- ── Task 2.15b — ON DELETE CASCADE for collection_items(url_id) ──────────────
-- If a URL is deleted (e.g. after moderation reversal), its collection_items
-- rows previously became orphaned. Cascade ensures referential integrity.
ALTER TABLE collection_items
  DROP CONSTRAINT IF EXISTS collection_items_url_id_fkey;

ALTER TABLE collection_items
  ADD CONSTRAINT collection_items_url_id_fkey
    FOREIGN KEY (url_id) REFERENCES urls (id) ON DELETE CASCADE;


-- ── Task 2.15a — moderation_audit_log table + auto-insert trigger ─────────────
CREATE TABLE IF NOT EXISTS moderation_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id    UUID        NOT NULL REFERENCES moderation_queue (id) ON DELETE CASCADE,
  admin_id    UUID        NOT NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  decision    TEXT        NOT NULL CHECK (decision IN ('approved', 'rejected')),
  decided_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: admin-read-only
ALTER TABLE moderation_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit log" ON moderation_audit_log;
CREATE POLICY "Admins can read audit log"
  ON moderation_audit_log
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Trigger: auto-insert a log row when moderation_queue.status changes from 'pending'
CREATE OR REPLACE FUNCTION fn_moderation_audit_log()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only fire when status changes away from 'pending' to a final decision
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO moderation_audit_log (queue_id, admin_id, decision, decided_at)
    VALUES (NEW.id, auth.uid(), NEW.status, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_moderation_audit_log ON moderation_queue;
CREATE TRIGGER trg_moderation_audit_log
  AFTER UPDATE OF status ON moderation_queue
  FOR EACH ROW EXECUTE FUNCTION fn_moderation_audit_log();


-- ── Task 4.23a — paywalled_domains lookup table ───────────────────────────────
-- Used by the roam() RPC to filter paywalled URLs when the user has
-- skip_paywalled = true. Publicly readable; service-role only for writes.
CREATE TABLE IF NOT EXISTS paywalled_domains (
  domain    TEXT        PRIMARY KEY,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE paywalled_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read paywalled_domains" ON paywalled_domains;
CREATE POLICY "Anyone can read paywalled_domains"
  ON paywalled_domains
  FOR SELECT
  USING (true);

-- Seed known paywalled domains
INSERT INTO paywalled_domains (domain) VALUES
  ('nytimes.com'),
  ('wsj.com'),
  ('ft.com'),
  ('bloomberg.com'),
  ('theatlantic.com'),
  ('newyorker.com'),
  ('thetimes.co.uk'),
  ('thetimes.com'),
  ('economist.com'),
  ('hbr.org'),
  ('wired.com'),
  ('washingtonpost.com'),
  ('bostonglobe.com'),
  ('latimes.com'),
  ('telegraph.co.uk'),
  ('sfchronicle.com'),
  ('chicagotribune.com'),
  ('foreignaffairs.com'),
  ('foreignpolicy.com'),
  ('scientificamerican.com'),
  ('nature.com'),
  ('science.org'),
  ('technologyreview.com'),
  ('spectator.co.uk'),
  ('newstatesman.com'),
  ('newrepublic.com'),
  ('slate.com'),
  ('medium.com')
ON CONFLICT (domain) DO NOTHING;
