-- =============================================================================
-- Roam — Tag Graph Schema
-- =============================================================================
-- Introduces the tag-based taxonomy that replaces subcategories for
-- personalization and discovery. Categories (8 pillars) are preserved as an
-- onboarding shorthand. See docs/TAG_SYSTEM.md for the full design.
--
-- Tables:
--   1. tags                    — the tag vocabulary (seeded by *_seed_tags.sql)
--   2. tag_relations           — graph edges (broader_than / related_to / similar_to)
--   3. url_tags                — URL → tag assignments
--   4. url_attributes          — content metadata (format, not interest)
--   5. user_tag_weights        — per-user interest weights (behavioral learning)
--   6. subcategory_tag_mapping — migration bridge from legacy subcategories
--   7. tagging_jobs            — LLM processing queue (Phase C+)
--   8. url_quality             — junk/spam detection (from the offline pipeline)
-- =============================================================================


-- ── 1. tags ──────────────────────────────────────────────────────────────────
CREATE TABLE public.tags (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT        UNIQUE NOT NULL,
  display_name TEXT        NOT NULL,
  pillar       TEXT        NOT NULL REFERENCES public.categories(slug),
  description  TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tags_pillar ON public.tags(pillar) WHERE is_active = TRUE;

CREATE TRIGGER trg_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ── 2. tag_relations ────────────────────────────────────────────────────────
-- relation: broader_than | narrower_than | related_to | similar_to
CREATE TABLE public.tag_relations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_tag_id UUID        NOT NULL REFERENCES public.tags ON DELETE CASCADE,
  to_tag_id   UUID        NOT NULL REFERENCES public.tags ON DELETE CASCADE,
  relation    TEXT        NOT NULL CHECK (relation IN ('broader_than', 'narrower_than', 'related_to', 'similar_to')),
  weight      NUMERIC(3,2) NOT NULL DEFAULT 0.5 CHECK (weight >= 0 AND weight <= 1),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_tag_id, to_tag_id, relation)
);

CREATE INDEX idx_tag_relations_from ON public.tag_relations(from_tag_id);
CREATE INDEX idx_tag_relations_to   ON public.tag_relations(to_tag_id);


-- ── 3. url_tags ─────────────────────────────────────────────────────────────
CREATE TABLE public.url_tags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  url_id     UUID        NOT NULL REFERENCES public.urls ON DELETE CASCADE,
  tag_id     UUID        NOT NULL REFERENCES public.tags ON DELETE CASCADE,
  confidence REAL        NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  source     TEXT        NOT NULL DEFAULT 'llm', -- 'llm' | 'subcategory-migration' | 'manual'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (url_id, tag_id)
);

CREATE INDEX idx_url_tags_tag ON public.url_tags(tag_id) INCLUDE (url_id);


-- ── 4. url_attributes ───────────────────────────────────────────────────────
-- Content FORMAT metadata — distinct from topic tags. One row per URL.
CREATE TABLE public.url_attributes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  url_id        UUID        NOT NULL REFERENCES public.urls ON DELETE CASCADE,
  audience_level TEXT       CHECK (audience_level IN ('beginner', 'intermediate', 'expert', 'general')),
  content_type  TEXT        CHECK (content_type IN (
    'explainer', 'research', 'opinion', 'how-to', 'narrative', 'news', 'review',
    'interview', 'longform', 'tutorial', 'infographic', 'podcast', 'video',
    'interactive', 'faq', 'data-journalism', 'article', 'other'
  )),
  depth         TEXT        CHECK (depth IN ('quick-read', 'medium', 'deep-dive')),
  tone          TEXT        CHECK (tone IN ('academic', 'playful', 'serious', 'technical', 'accessible', 'inspirational', 'critical', 'neutral')),
  is_news       BOOLEAN     NOT NULL DEFAULT FALSE,
  confidence    REAL        NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (url_id)
);

CREATE TRIGGER trg_url_attributes_updated_at
  BEFORE UPDATE ON public.url_attributes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 5. user_tag_weights ─────────────────────────────────────────────────────
-- Per-user interest weights, updated by DB triggers on ratings/saves/shares.
CREATE TABLE public.user_tag_weights (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tag_id       UUID         NOT NULL REFERENCES public.tags ON DELETE CASCADE,
  weight       NUMERIC(8,2) NOT NULL DEFAULT 0,
  signal_count INT          NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tag_id)
);

CREATE INDEX idx_user_tag_weights_user ON public.user_tag_weights(user_id);
CREATE INDEX idx_user_tag_weights_tag  ON public.user_tag_weights(tag_id);

CREATE TRIGGER trg_user_tag_weights_updated_at
  BEFORE UPDATE ON public.user_tag_weights
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ── 6. subcategory_tag_mapping ──────────────────────────────────────────────
-- Migration bridge: maps a legacy subcategory to one or more tags so existing
-- subcategory assignments can be backfilled into url_tags.
CREATE TABLE public.subcategory_tag_mapping (
  subcategory_slug TEXT NOT NULL REFERENCES public.subcategories(slug) ON DELETE CASCADE,
  tag_id           UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (subcategory_slug, tag_id)
);


-- ── 7. tagging_jobs ─────────────────────────────────────────────────────────
-- Queue of URLs awaiting LLM tagging (Phase C real-time tagging).
CREATE TABLE public.tagging_jobs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  url_id     UUID        NOT NULL REFERENCES public.urls ON DELETE CASCADE,
  status     TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  priority   INT         NOT NULL DEFAULT 0,
  attempts   INT         NOT NULL DEFAULT 0,
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (url_id)
);

CREATE INDEX idx_tagging_jobs_pending
  ON public.tagging_jobs(status, priority DESC, created_at)
  WHERE status = 'pending';

CREATE TRIGGER trg_tagging_jobs_updated_at
  BEFORE UPDATE ON public.tagging_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ── 8. url_quality ─────────────────────────────────────────────────────────
-- Junk/spam detection — mirrors the offline `local_url_quality` table so the
-- tagging worker's quality assessments have a production home.
CREATE TABLE public.url_quality (
  url_id            UUID        PRIMARY KEY REFERENCES public.urls ON DELETE CASCADE,
  url_type          TEXT        NOT NULL,
  quality_score     INTEGER     NOT NULL CHECK (quality_score >= 0 AND quality_score <= 10),
  is_parked         BOOLEAN     NOT NULL DEFAULT FALSE,
  is_product        BOOLEAN     NOT NULL DEFAULT FALSE,
  is_spam           BOOLEAN     NOT NULL DEFAULT FALSE,
  is_paywalled      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_login_required BOOLEAN     NOT NULL DEFAULT FALSE,
  is_broken         BOOLEAN     NOT NULL DEFAULT FALSE,
  is_thin           BOOLEAN     NOT NULL DEFAULT FALSE,
  is_clickbait      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_english        BOOLEAN     NOT NULL DEFAULT TRUE,
  confidence        REAL        NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_url_quality_score ON public.url_quality(quality_score);
CREATE INDEX idx_url_quality_type  ON public.url_quality(url_type);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.tags                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_relations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.url_tags                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.url_attributes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.url_quality             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tag_weights        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategory_tag_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tagging_jobs            ENABLE ROW LEVEL SECURITY;

-- tags: public read, admin write (seeders/tagging use service role, which bypasses RLS)
CREATE POLICY "tags: readable by everyone"
  ON public.tags FOR SELECT USING (TRUE);
CREATE POLICY "tags: admin write"
  ON public.tags FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- tag_relations: public read, admin write
CREATE POLICY "tag_relations: readable by everyone"
  ON public.tag_relations FOR SELECT USING (TRUE);
CREATE POLICY "tag_relations: admin write"
  ON public.tag_relations FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- url_tags: public read, admin write
CREATE POLICY "url_tags: readable by everyone"
  ON public.url_tags FOR SELECT USING (TRUE);
CREATE POLICY "url_tags: admin write"
  ON public.url_tags FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- url_attributes: public read, admin write
CREATE POLICY "url_attributes: readable by everyone"
  ON public.url_attributes FOR SELECT USING (TRUE);
CREATE POLICY "url_attributes: admin write"
  ON public.url_attributes FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- url_quality: public read, admin write
CREATE POLICY "url_quality: readable by everyone"
  ON public.url_quality FOR SELECT USING (TRUE);
CREATE POLICY "url_quality: admin write"
  ON public.url_quality FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- user_tag_weights: owner read only; writes happen via service role (triggers)
CREATE POLICY "user_tag_weights: owner read"
  ON public.user_tag_weights FOR SELECT USING (auth.uid() = user_id);

-- subcategory_tag_mapping: public read, admin write
CREATE POLICY "subcategory_tag_mapping: readable by everyone"
  ON public.subcategory_tag_mapping FOR SELECT USING (TRUE);
CREATE POLICY "subcategory_tag_mapping: admin write"
  ON public.subcategory_tag_mapping FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- tagging_jobs: system only (no client policies — service role only)

