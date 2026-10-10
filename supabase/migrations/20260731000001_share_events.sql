-- =============================================================================
-- share_events — Track URL/content sharing for share-related badges
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.share_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url_id     UUID REFERENCES public.urls(id) ON DELETE SET NULL,
  collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL,
  share_type TEXT NOT NULL DEFAULT 'url', -- 'url', 'collection', 'profile'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS share_events_user_id_idx ON public.share_events(user_id);
CREATE INDEX IF NOT EXISTS share_events_created_at_idx ON public.share_events(created_at);
ALTER TABLE public.share_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own shares" ON public.share_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert shares" ON public.share_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public can read shares" ON public.share_events FOR SELECT USING (true);