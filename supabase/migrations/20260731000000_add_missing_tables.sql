-- =============================================================================
-- Add missing tables that badges reference but never got created:
--   1. url_ratings        — up/down rating per URL per user
--   2. collection_favorites — users favoriting public collections
--   3. log_failed_urls    — 404 tracking for error-404-explorer badge
-- =============================================================================

-- 1. URL Ratings (up/down voting)
CREATE TABLE IF NOT EXISTS public.url_ratings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url_id     UUID NOT NULL REFERENCES public.urls(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL DEFAULT 0 CHECK (rating IN (-1, 0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, url_id)
);
CREATE INDEX IF NOT EXISTS url_ratings_user_id_idx ON public.url_ratings(user_id);
CREATE INDEX IF NOT EXISTS url_ratings_url_id_idx  ON public.url_ratings(url_id);
ALTER TABLE public.url_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own ratings"    ON public.url_ratings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ratings"   ON public.url_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ratings"   ON public.url_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Public can read ratings"         ON public.url_ratings FOR SELECT USING (true);

-- 2. Collection favorites
CREATE TABLE IF NOT EXISTS public.collection_favorites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id)    ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, collection_id)
);
CREATE INDEX IF NOT EXISTS collection_favorites_user_id_idx       ON public.collection_favorites(user_id);
CREATE INDEX IF NOT EXISTS collection_favorites_collection_id_idx ON public.collection_favorites(collection_id);
ALTER TABLE public.collection_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own favorites"  ON public.collection_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert favorites"    ON public.collection_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete favorites"    ON public.collection_favorites FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public can read favorites"     ON public.collection_favorites FOR SELECT USING (true);

-- 3. Failed URL log (404 tracking)
CREATE TABLE IF NOT EXISTS public.log_failed_urls (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  status_code SMALLINT NOT NULL DEFAULT 404,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS log_failed_urls_user_id_idx ON public.log_failed_urls(user_id);
ALTER TABLE public.log_failed_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own failed URLs" ON public.log_failed_urls FOR SELECT USING (auth.uid() = user_id);