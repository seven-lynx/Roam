-- =============================================================================
-- Roam — Initial Database Migration
-- =============================================================================
-- Covers: all tables, indexes, RLS policies, Wilson score trigger,
--         roam() RPC function, pg_cron cleanup job,
--         and seeded category / subcategory data.
-- =============================================================================


-- ── Extensions ────────────────────────────────────────────────────────────────
-- pg_cron: nightly seen_urls cleanup job.
-- If this line errors, enable pg_cron from the Supabase dashboard
-- (Database → Extensions → pg_cron) and re-run.
CREATE EXTENSION IF NOT EXISTS "pg_cron";


-- ── Helper: admin check ───────────────────────────────────────────────────────
-- Used in RLS policies. Returns TRUE only for the user whose app_metadata
-- contains {"role": "admin"} — set via the Supabase dashboard on the owner
-- account. Any policy that calls is_admin() will return FALSE for all other
-- users, including unauthenticated callers.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', FALSE)
$$;


-- ── Helper: updated_at trigger ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- TABLES (in dependency order)
-- =============================================================================


-- ── profiles ──────────────────────────────────────────────────────────────────
-- One row per Supabase auth user. Created during the /join onboarding flow
-- once the user has chosen a username.
CREATE TABLE public.profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username     TEXT        UNIQUE NOT NULL,
  display_name TEXT        NOT NULL DEFAULT '',
  bio          TEXT,
  avatar_url   TEXT,
  is_public    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── categories ────────────────────────────────────────────────────────────────
-- The 8 top-level interest pillars. Seeded below; never written by users.
CREATE TABLE public.categories (
  id         UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT     NOT NULL,
  slug       TEXT     UNIQUE NOT NULL,
  icon       TEXT     NOT NULL,
  sort_order SMALLINT NOT NULL
);


-- ── subcategories ─────────────────────────────────────────────────────────────
-- 72 subcategories (9 per pillar). Seeded below; never written by users.
CREATE TABLE public.subcategories (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID     NOT NULL REFERENCES categories ON DELETE CASCADE,
  name        TEXT     NOT NULL,
  slug        TEXT     UNIQUE NOT NULL,
  sort_order  SMALLINT NOT NULL
);


-- ── user_categories ───────────────────────────────────────────────────────────
-- Records which categories / subcategories a user has selected.
-- A row with subcategory_id = NULL means "entire pillar selected".
-- A row with a subcategory_id means that specific subcategory is selected.
-- When a user selects subcategory refinements for a pillar, the roam()
-- function switches to subcategory-only filtering for that pillar.
CREATE TABLE public.user_categories (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  category_id    UUID        NOT NULL REFERENCES categories  ON DELETE CASCADE,
  subcategory_id UUID        REFERENCES subcategories ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (user_id, category_id, subcategory_id)
);


-- ── urls ──────────────────────────────────────────────────────────────────────
-- Every URL in the discovery pool.
-- `url` stores the normalised form (https, no www, no UTM, no trailing slash).
-- `wilson_score` is recalculated by a trigger on every insert/update/delete
-- to the ratings table.
CREATE TABLE public.urls (
  id             UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  url            TEXT             UNIQUE NOT NULL,
  original_url   TEXT             NOT NULL,
  title          TEXT,
  description    TEXT,
  og_image_url   TEXT,
  category_id    UUID             REFERENCES categories    ON DELETE SET NULL,
  subcategory_id UUID             REFERENCES subcategories ON DELETE SET NULL,
  approved       BOOLEAN          NOT NULL DEFAULT FALSE,
  source         TEXT             NOT NULL DEFAULT 'community',
  wilson_score   DOUBLE PRECISION NOT NULL DEFAULT 0,
  upvotes        INT              NOT NULL DEFAULT 0,
  downvotes      INT              NOT NULL DEFAULT 0,
  submitted_by   UUID             REFERENCES auth.users ON DELETE SET NULL,
  created_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_urls_updated_at
  BEFORE UPDATE ON urls
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ── ratings ───────────────────────────────────────────────────────────────────
-- One row per user × URL rating event. value is +1 (up) or -1 (down).
-- Each user can rate a given URL only once; subsequent votes overwrite.
CREATE TABLE public.ratings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  url_id     UUID        NOT NULL REFERENCES urls       ON DELETE CASCADE,
  value      SMALLINT    NOT NULL CHECK (value IN (1, -1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, url_id)
);


-- ── seen_urls ─────────────────────────────────────────────────────────────────
-- Written by roam() the moment a URL is served. Excludes that URL from future
-- recommendations for 30 days. Nightly pg_cron job removes rows older than 30
-- days so this table never grows unboundedly.
CREATE TABLE public.seen_urls (
  id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  url_id  UUID        NOT NULL REFERENCES urls       ON DELETE CASCADE,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, url_id)
);


-- ── collections ───────────────────────────────────────────────────────────────
-- User-created named lists of URLs. Public collections are accessible at
-- /c/collection-slug on the web layer.
CREATE TABLE public.collections (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  slug       TEXT        UNIQUE NOT NULL,
  is_public  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ── collection_items ─────────────────────────────────────────────────────────
-- Junction table: URLs inside a collection.
CREATE TABLE public.collection_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID        NOT NULL REFERENCES collections ON DELETE CASCADE,
  url_id        UUID        NOT NULL REFERENCES urls        ON DELETE CASCADE,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (collection_id, url_id)
);


-- ── follows ───────────────────────────────────────────────────────────────────
-- Asymmetric follow graph. is_pending = TRUE when the target profile is private
-- and has not yet accepted the request.
CREATE TABLE public.follows (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  is_pending   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);


-- ── moderation_queue ─────────────────────────────────────────────────────────
-- URLs submitted by users awaiting admin review.
-- safe_browsing_passed is set by the submit-url Edge Function before insertion.
CREATE TABLE public.moderation_queue (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  url                  TEXT        NOT NULL,
  title                TEXT,
  description          TEXT,
  subcategory_id       UUID        REFERENCES subcategories ON DELETE SET NULL,
  submitted_by         UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  safe_browsing_passed BOOLEAN,
  status               TEXT        NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_note        TEXT,
  reviewed_by          UUID        REFERENCES auth.users ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_moderation_queue_updated_at
  BEFORE UPDATE ON moderation_queue
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- INDEXES
-- =============================================================================

-- Primary discovery query: filters by subcategory, approved status, then
-- weights by wilson_score. Partial index on approved = TRUE keeps it lean.
CREATE INDEX idx_urls_discovery
  ON urls (subcategory_id, wilson_score DESC)
  WHERE approved = TRUE;

-- seen_urls lookup: used on every roam() call to exclude already-seen URLs.
CREATE INDEX idx_seen_urls_lookup
  ON seen_urls (user_id, url_id);

-- user_categories: used on every roam() call to find the user's active filters.
CREATE INDEX idx_user_categories_user
  ON user_categories (user_id);

-- collection_items: used in collection-mode roam() calls.
CREATE INDEX idx_collection_items_collection
  ON collection_items (collection_id);

-- moderation_queue: admin queue lists pending items newest-first.
CREATE INDEX idx_moderation_queue_pending
  ON moderation_queue (status, created_at)
  WHERE status = 'pending';


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urls              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seen_urls         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_queue  ENABLE ROW LEVEL SECURITY;


-- ── profiles ──────────────────────────────────────────────────────────────────
-- Public profiles are readable by anyone. Private profiles are readable only by
-- the owner. Users can only write their own profile row.
CREATE POLICY "profiles: public profiles readable by everyone"
  ON profiles FOR SELECT
  USING (is_public = TRUE OR auth.uid() = id);

CREATE POLICY "profiles: users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles: users can delete own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);


-- ── categories & subcategories ────────────────────────────────────────────────
-- Read-only to everyone. Writes only via service role key (seeder scripts).
CREATE POLICY "categories: readable by everyone"
  ON categories FOR SELECT
  USING (TRUE);

CREATE POLICY "subcategories: readable by everyone"
  ON subcategories FOR SELECT
  USING (TRUE);


-- ── user_categories ───────────────────────────────────────────────────────────
-- Users manage only their own preference rows.
CREATE POLICY "user_categories: users manage own"
  ON user_categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── urls ──────────────────────────────────────────────────────────────────────
-- Approved URLs are readable by everyone (required for the Roam button to work
-- without authentication on the web layer). Admin can read and write all rows.
-- Seeder scripts use the service role key, which bypasses RLS entirely.
CREATE POLICY "urls: approved URLs readable by everyone"
  ON urls FOR SELECT
  USING (approved = TRUE OR public.is_admin());

CREATE POLICY "urls: admin can insert"
  ON urls FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "urls: admin can update"
  ON urls FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "urls: admin can delete"
  ON urls FOR DELETE
  USING (public.is_admin());


-- ── ratings ───────────────────────────────────────────────────────────────────
CREATE POLICY "ratings: users can read own"
  ON ratings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "ratings: users can insert own"
  ON ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ratings: users can update own"
  ON ratings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── seen_urls ─────────────────────────────────────────────────────────────────
-- Written exclusively by roam() (SECURITY DEFINER), so no INSERT policy needed
-- for regular users. Users can read their own rows for debugging/stats.
CREATE POLICY "seen_urls: users can read own"
  ON seen_urls FOR SELECT
  USING (auth.uid() = user_id);


-- ── collections ───────────────────────────────────────────────────────────────
-- Public collections are readable by everyone. Private collections are readable
-- by the owner and by approved followers.
CREATE POLICY "collections: public readable by everyone"
  ON collections FOR SELECT
  USING (
    is_public = TRUE
    OR auth.uid() = user_id
    OR (
      is_public = FALSE
      AND EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = auth.uid()
          AND following_id = collections.user_id
          AND is_pending = FALSE
      )
    )
  );

CREATE POLICY "collections: users can insert own"
  ON collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collections: users can update own"
  ON collections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "collections: users can delete own"
  ON collections FOR DELETE
  USING (auth.uid() = user_id);


-- ── collection_items ─────────────────────────────────────────────────────────
-- Inherits parent collection visibility rules.
CREATE POLICY "collection_items: readable if parent collection is readable"
  ON collection_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
        AND (
          c.is_public = TRUE
          OR c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM follows f
            WHERE f.follower_id = auth.uid()
              AND f.following_id = c.user_id
              AND f.is_pending = FALSE
          )
        )
    )
  );

CREATE POLICY "collection_items: collection owner can insert"
  ON collection_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "collection_items: collection owner can delete"
  ON collection_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
        AND c.user_id = auth.uid()
    )
  );


-- ── follows ───────────────────────────────────────────────────────────────────
CREATE POLICY "follows: users can see own relationships"
  ON follows FOR SELECT
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "follows: authenticated users can follow"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows: either party can update"
  ON follows FOR UPDATE
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "follows: either party can delete"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id OR auth.uid() = following_id);


-- ── moderation_queue ─────────────────────────────────────────────────────────
CREATE POLICY "moderation_queue: submitter and admin can read"
  ON moderation_queue FOR SELECT
  USING (auth.uid() = submitted_by OR public.is_admin());

CREATE POLICY "moderation_queue: authenticated users can submit"
  ON moderation_queue FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "moderation_queue: admin can update"
  ON moderation_queue FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "moderation_queue: admin can delete"
  ON moderation_queue FOR DELETE
  USING (public.is_admin());


-- =============================================================================
-- WILSON SCORE TRIGGER
-- =============================================================================
-- Recalculates wilson_score (and upvotes/downvotes counts) on the urls table
-- whenever a rating is inserted, updated, or deleted.
-- Formula: Wilson score confidence interval at 95% (z = 1.96).
-- A URL with 10/10 upvotes scores higher than one with 600/1000 — the score
-- converges toward the true approval rate as the sample size grows.

CREATE OR REPLACE FUNCTION public.recalculate_wilson_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url_id UUID;
  v_ups    INT;
  v_downs  INT;
  v_n      INT;
  v_p      FLOAT;
  v_z      FLOAT := 1.96;
  v_score  FLOAT;
BEGIN
  v_url_id := COALESCE(NEW.url_id, OLD.url_id);

  SELECT
    COUNT(*) FILTER (WHERE value =  1),
    COUNT(*) FILTER (WHERE value = -1)
  INTO v_ups, v_downs
  FROM ratings
  WHERE url_id = v_url_id;

  v_n := v_ups + v_downs;

  IF v_n = 0 THEN
    v_score := 0;
  ELSE
    v_p     := v_ups::FLOAT / v_n;
    v_score := (
      v_p + v_z * v_z / (2 * v_n)
      - v_z * SQRT((v_p * (1 - v_p) + v_z * v_z / (4 * v_n)) / v_n)
    ) / (1 + v_z * v_z / v_n);
  END IF;

  UPDATE urls
  SET
    wilson_score = v_score,
    upvotes      = v_ups,
    downvotes    = v_downs,
    updated_at   = NOW()
  WHERE id = v_url_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_wilson_score
  AFTER INSERT OR UPDATE OR DELETE ON ratings
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_wilson_score();


-- =============================================================================
-- roam() RPC FUNCTION
-- =============================================================================
-- Called from all three surfaces via Supabase's built-in RPC interface.
-- Runs inside the database with no cold-start latency.
--
-- Standard mode (p_collection_id = NULL):
--   Serves a URL matching the user's active category preferences, excluding
--   anything seen within the last 30 days. Weighted by wilson_score.
--
-- Collection mode (p_collection_id provided):
--   Serves a URL from the specified collection, bypassing category filtering.
--   30-day seen exclusion still applies.
--
-- In both modes, the served URL is immediately written to seen_urls so the
-- same URL is never served twice in a session (regardless of whether the user
-- rates it).

CREATE OR REPLACE FUNCTION public.roam(
  p_user_id       UUID,
  p_collection_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id             UUID,
  url            TEXT,
  title          TEXT,
  description    TEXT,
  og_image_url   TEXT,
  subcategory_id UUID,
  wilson_score   DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url_id UUID;
BEGIN
  -- Callers may only roam as themselves.
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_collection_id IS NOT NULL THEN
    -- ── Collection mode ────────────────────────────────────────────────────
    SELECT u.id INTO v_url_id
    FROM urls u
    INNER JOIN collection_items ci ON ci.url_id = u.id
    WHERE ci.collection_id = p_collection_id
      AND u.approved = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM seen_urls su
        WHERE su.user_id = p_user_id AND su.url_id = u.id
      )
    ORDER BY (u.wilson_score + 0.1) * random() DESC
    LIMIT 1;

  ELSE
    -- ── Standard mode ──────────────────────────────────────────────────────
    SELECT u.id INTO v_url_id
    FROM urls u
    INNER JOIN subcategories sc ON sc.id = u.subcategory_id
    WHERE u.approved = TRUE
      AND (
        -- User explicitly selected this subcategory
        EXISTS (
          SELECT 1 FROM user_categories uc
          WHERE uc.user_id = p_user_id
            AND uc.subcategory_id = u.subcategory_id
        )
        OR (
          -- User selected the whole pillar with no subcategory refinements
          EXISTS (
            SELECT 1 FROM user_categories uc
            WHERE uc.user_id = p_user_id
              AND uc.category_id = sc.category_id
              AND uc.subcategory_id IS NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM user_categories uc2
            WHERE uc2.user_id = p_user_id
              AND uc2.category_id = sc.category_id
              AND uc2.subcategory_id IS NOT NULL
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM seen_urls su
        WHERE su.user_id = p_user_id AND su.url_id = u.id
      )
    ORDER BY (u.wilson_score + 0.1) * random() DESC
    LIMIT 1;
  END IF;

  -- Record as seen immediately (on serve, not on rate).
  IF v_url_id IS NOT NULL THEN
    INSERT INTO seen_urls (user_id, url_id)
    VALUES (p_user_id, v_url_id)
    ON CONFLICT (user_id, url_id) DO NOTHING;
  END IF;

  -- Return the selected URL row (empty result set if pool is exhausted).
  RETURN QUERY
  SELECT u.id, u.url, u.title, u.description, u.og_image_url,
         u.subcategory_id, u.wilson_score
  FROM urls u
  WHERE u.id = v_url_id;
END;
$$;


-- =============================================================================
-- pg_cron: NIGHTLY seen_urls CLEANUP
-- =============================================================================
-- Deletes seen_urls rows older than 30 days every night at 03:00 UTC.
-- This keeps the table bounded regardless of usage volume.
-- Idempotent: skips scheduling if the job already exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'delete-old-seen-urls'
  ) THEN
    PERFORM cron.schedule(
      'delete-old-seen-urls',
      '0 3 * * *',
      'DELETE FROM public.seen_urls WHERE seen_at < NOW() - INTERVAL ''30 days'''
    );
  END IF;
END;
$$;


-- =============================================================================
-- SEED DATA: CATEGORIES
-- =============================================================================
-- Fixed UUIDs so foreign keys in subcategories are stable across environments.

INSERT INTO public.categories (id, name, slug, icon, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Science & Nature',  'science-nature',  '🔬', 1),
  ('c1000000-0000-0000-0000-000000000002', 'Technology',        'technology',      '💻', 2),
  ('c1000000-0000-0000-0000-000000000003', 'Arts & Culture',    'arts-culture',    '🎨', 3),
  ('c1000000-0000-0000-0000-000000000004', 'History & Ideas',   'history-ideas',   '📜', 4),
  ('c1000000-0000-0000-0000-000000000005', 'Games & Hobbies',   'games-hobbies',   '🎮', 5),
  ('c1000000-0000-0000-0000-000000000006', 'Weird & Wonderful', 'weird-wonderful', '🌀', 6),
  ('c1000000-0000-0000-0000-000000000007', 'People & Places',   'people-places',   '🌍', 7),
  ('c1000000-0000-0000-0000-000000000008', 'Mind & Body',       'mind-body',       '🧠', 8);


-- =============================================================================
-- SEED DATA: SUBCATEGORIES
-- =============================================================================

INSERT INTO public.subcategories (category_id, name, slug, sort_order) VALUES

  -- 🔬 Science & Nature
  ('c1000000-0000-0000-0000-000000000001', 'Space & Astronomy',              'space-astronomy',             1),
  ('c1000000-0000-0000-0000-000000000001', 'Biology & Evolution',            'biology-evolution',           2),
  ('c1000000-0000-0000-0000-000000000001', 'Physics & Chemistry',            'physics-chemistry',           3),
  ('c1000000-0000-0000-0000-000000000001', 'Environment & Climate',          'environment-climate',         4),
  ('c1000000-0000-0000-0000-000000000001', 'Medicine & Health Science',      'medicine-health-science',     5),
  ('c1000000-0000-0000-0000-000000000001', 'Mathematics & Logic',            'mathematics-logic',           6),
  ('c1000000-0000-0000-0000-000000000001', 'Geology & Earth Science',        'geology-earth-science',       7),
  ('c1000000-0000-0000-0000-000000000001', 'Oceanography & Marine Life',     'oceanography-marine-life',    8),
  ('c1000000-0000-0000-0000-000000000001', 'Paleontology & Natural History', 'paleontology-natural-history', 9),

  -- 💻 Technology
  ('c1000000-0000-0000-0000-000000000002', 'Programming & Software Development', 'programming-software',    1),
  ('c1000000-0000-0000-0000-000000000002', 'Design & UX',                        'design-ux',               2),
  ('c1000000-0000-0000-0000-000000000002', 'AI & Machine Learning',              'ai-machine-learning',     3),
  ('c1000000-0000-0000-0000-000000000002', 'Hardware & Electronics',             'hardware-electronics',    4),
  ('c1000000-0000-0000-0000-000000000002', 'Cybersecurity & Privacy',            'cybersecurity-privacy',   5),
  ('c1000000-0000-0000-0000-000000000002', 'Internet Culture & Web History',     'internet-culture',        6),
  ('c1000000-0000-0000-0000-000000000002', 'Robotics & Automation',              'robotics-automation',     7),
  ('c1000000-0000-0000-0000-000000000002', 'Emerging Technology',                'emerging-technology',     8),
  ('c1000000-0000-0000-0000-000000000002', 'Open Source & Dev Communities',      'open-source',             9),

  -- 🎨 Arts & Culture
  ('c1000000-0000-0000-0000-000000000003', 'Music',                       'music',                   1),
  ('c1000000-0000-0000-0000-000000000003', 'Film & Television',           'film-television',         2),
  ('c1000000-0000-0000-0000-000000000003', 'Visual Art & Painting',       'visual-art',              3),
  ('c1000000-0000-0000-0000-000000000003', 'Comics & Illustration',       'comics-illustration',     4),
  ('c1000000-0000-0000-0000-000000000003', 'Literature & Writing',        'literature-writing',      5),
  ('c1000000-0000-0000-0000-000000000003', 'Photography',                 'photography',             6),
  ('c1000000-0000-0000-0000-000000000003', 'Architecture & Urban Design', 'architecture-urban',      7),
  ('c1000000-0000-0000-0000-000000000003', 'Theatre & Performance',       'theatre-performance',     8),
  ('c1000000-0000-0000-0000-000000000003', 'Fashion & Textiles',          'fashion-textiles',        9),

  -- 📜 History & Ideas
  ('c1000000-0000-0000-0000-000000000004', 'Ancient & Medieval History',   'ancient-medieval-history',  1),
  ('c1000000-0000-0000-0000-000000000004', 'Modern History',               'modern-history',            2),
  ('c1000000-0000-0000-0000-000000000004', 'Philosophy & Ethics',          'philosophy-ethics',         3),
  ('c1000000-0000-0000-0000-000000000004', 'Politics & Geopolitics',       'politics-geopolitics',      4),
  ('c1000000-0000-0000-0000-000000000004', 'Religion & Mythology',         'religion-mythology',        5),
  ('c1000000-0000-0000-0000-000000000004', 'Anthropology & Archaeology',   'anthropology-archaeology',  6),
  ('c1000000-0000-0000-0000-000000000004', 'Economics & Economic History', 'economics-history',         7),
  ('c1000000-0000-0000-0000-000000000004', 'Social History & Movements',   'social-history',            8),
  ('c1000000-0000-0000-0000-000000000004', 'Military History',             'military-history',          9),

  -- 🎮 Games & Hobbies
  ('c1000000-0000-0000-0000-000000000005', 'Video Games',                    'video-games',             1),
  ('c1000000-0000-0000-0000-000000000005', 'Board Games & Tabletop RPGs',    'board-games-tabletop',    2),
  ('c1000000-0000-0000-0000-000000000005', 'Sports & Athletics',             'sports-athletics',        3),
  ('c1000000-0000-0000-0000-000000000005', 'Cooking & Food',                 'cooking-food',            4),
  ('c1000000-0000-0000-0000-000000000005', 'Crafts, DIY & Making',           'crafts-diy-making',       5),
  ('c1000000-0000-0000-0000-000000000005', 'Collecting & Enthusiast Culture','collecting',              6),
  ('c1000000-0000-0000-0000-000000000005', 'Outdoor Activities & Adventure', 'outdoor-adventure',       7),
  ('c1000000-0000-0000-0000-000000000005', 'Gardening & Horticulture',       'gardening-horticulture',  8),
  ('c1000000-0000-0000-0000-000000000005', 'Puzzles & Brain Teasers',        'puzzles-brain-teasers',   9),

  -- 🌀 Weird & Wonderful
  ('c1000000-0000-0000-0000-000000000006', 'Oddities & Curiosities',            'oddities-curiosities',  1),
  ('c1000000-0000-0000-0000-000000000006', 'True Crime & Mysteries',            'true-crime-mysteries',  2),
  ('c1000000-0000-0000-0000-000000000006', 'Paranormal & Unexplained',          'paranormal-unexplained', 3),
  ('c1000000-0000-0000-0000-000000000006', 'Vintage Internet & Digital Archaeology', 'vintage-internet', 4),
  ('c1000000-0000-0000-0000-000000000006', 'Absurdist Humour & Satire',         'absurdist-humour',      5),
  ('c1000000-0000-0000-0000-000000000006', 'Urban Legends & Folklore',          'urban-legends-folklore', 6),
  ('c1000000-0000-0000-0000-000000000006', 'Conspiracy Theories & Fringe Ideas','conspiracy-fringe',     7),
  ('c1000000-0000-0000-0000-000000000006', 'Unusual Places & Secret Spaces',    'unusual-places',        8),
  ('c1000000-0000-0000-0000-000000000006', 'Lost Media & Forgotten Things',     'lost-media',            9),

  -- 🌍 People & Places
  ('c1000000-0000-0000-0000-000000000007', 'Travel & Exploration',             'travel-exploration',    1),
  ('c1000000-0000-0000-0000-000000000007', 'Cities & Urban Life',              'cities-urban-life',     2),
  ('c1000000-0000-0000-0000-000000000007', 'Biographies & Profiles',           'biographies-profiles',  3),
  ('c1000000-0000-0000-0000-000000000007', 'Languages & Linguistics',          'languages-linguistics', 4),
  ('c1000000-0000-0000-0000-000000000007', 'Indigenous Cultures & Traditions', 'indigenous-cultures',   5),
  ('c1000000-0000-0000-0000-000000000007', 'Subcultures & Communities',        'subcultures-communities', 6),
  ('c1000000-0000-0000-0000-000000000007', 'Migration & Diaspora Stories',     'migration-diaspora',    7),
  ('c1000000-0000-0000-0000-000000000007', 'Maps & Cartography',               'maps-cartography',      8),
  ('c1000000-0000-0000-0000-000000000007', 'Festivals, Customs & Traditions',  'festivals-customs',     9),

  -- 🧠 Mind & Body
  ('c1000000-0000-0000-0000-000000000008', 'Psychology & Human Behaviour', 'psychology-behaviour',    1),
  ('c1000000-0000-0000-0000-000000000008', 'Mental Health & Wellbeing',    'mental-health',           2),
  ('c1000000-0000-0000-0000-000000000008', 'Fitness & Movement',           'fitness-movement',        3),
  ('c1000000-0000-0000-0000-000000000008', 'Nutrition & Health',           'nutrition-health',        4),
  ('c1000000-0000-0000-0000-000000000008', 'Neuroscience & Brain Science', 'neuroscience',            5),
  ('c1000000-0000-0000-0000-000000000008', 'Mindfulness & Meditation',     'mindfulness-meditation',  6),
  ('c1000000-0000-0000-0000-000000000008', 'Sleep & Recovery',             'sleep-recovery',          7),
  ('c1000000-0000-0000-0000-000000000008', 'Relationships & Social Dynamics', 'relationships-social', 8),
  ('c1000000-0000-0000-0000-000000000008', 'Personal Development & Habits', 'personal-development',   9);
