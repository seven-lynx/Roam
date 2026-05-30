-- Partial index for admin_analytics top-rated URLs query.
-- Without this, the query does a parallel seq scan of 3.18M rows (~15s).
-- With this, it scans only the ~273 approved + voted URLs (<100ms).
CREATE INDEX IF NOT EXISTS idx_urls_rated
ON public.urls (wilson_score DESC)
WHERE approved = true AND upvotes + downvotes > 0;
