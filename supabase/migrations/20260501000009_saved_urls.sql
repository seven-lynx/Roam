-- saved_urls: server-side saved-for-later list
-- Mirrors what the Android app stores in SharedPreferences, but persisted
-- server-side so saves survive uninstall and are visible on the web dashboard.

CREATE TABLE IF NOT EXISTS public.saved_urls (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  url_id     UUID        REFERENCES public.urls ON DELETE SET NULL,
  url        TEXT        NOT NULL,
  title      TEXT        NOT NULL DEFAULT '',
  saved_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate saves for the same (user, url) pair
CREATE UNIQUE INDEX IF NOT EXISTS saved_urls_user_url_uniq
  ON public.saved_urls (user_id, url);

CREATE INDEX IF NOT EXISTS idx_saved_urls_user_id
  ON public.saved_urls (user_id, saved_at DESC);

ALTER TABLE public.saved_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_urls: users can read own"
  ON public.saved_urls FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "saved_urls: users can insert own"
  ON public.saved_urls FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_urls: users can delete own"
  ON public.saved_urls FOR DELETE
  USING (auth.uid() = user_id);
