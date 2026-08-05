CREATE TABLE IF NOT EXISTS public.url_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url_id UUID NOT NULL,
  rating SMALLINT NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS url_ratings_user_id_idx ON public.url_ratings(user_id);
ALTER TABLE public.url_ratings ENABLE ROW LEVEL SECURITY;