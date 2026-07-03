-- Scrape suggestions table: moderators can log URLs and domains to scrape
-- Applied directly via Supabase MCP on 2026-07-02

CREATE TABLE public.scrape_suggestions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_type TEXT        NOT NULL CHECK (suggestion_type IN ('url', 'domain')),
  value           TEXT        NOT NULL,
  category_id     UUID        REFERENCES public.categories    ON DELETE SET NULL,
  subcategory_id  UUID        REFERENCES public.subcategories ON DELETE SET NULL,
  notes           TEXT,
  suggested_by    UUID        NOT NULL REFERENCES auth.users  ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected', 'scraped')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.scrape_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scrape_suggestions: moderator can insert"
  ON public.scrape_suggestions FOR INSERT
  WITH CHECK (auth.uid() = suggested_by AND public.is_moderator());

CREATE POLICY "scrape_suggestions: moderator can read"
  ON public.scrape_suggestions FOR SELECT
  USING (public.is_moderator());

CREATE POLICY "scrape_suggestions: admin can update"
  ON public.scrape_suggestions FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "scrape_suggestions: admin can delete"
  ON public.scrape_suggestions FOR DELETE
  USING (public.is_admin());
