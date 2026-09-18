-- Covering index for fast SUM(serve_count) and AVG(wilson_score) aggregates
-- over approved+active URLs in admin_url_stats(). Without this, those queries
-- do 1.7M heap fetches which cause statement timeout when called from Vercel.
CREATE INDEX IF NOT EXISTS idx_urls_active_aggregates
  ON public.urls (serve_count, wilson_score)
  WHERE approved = true AND inactive = false;
