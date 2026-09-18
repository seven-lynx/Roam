-- Create the partial index referenced by admin_url_stats() v2.
-- The v2 function uses pg_class.reltuples on 'idx_urls_active_partial' for
-- a fast approximate count of approved+active URLs, but this index was never
-- created — only idx_urls_approved_partial existed — causing the RPC to throw
-- "relation does not exist" and the admin dashboard to show no stats.

CREATE INDEX IF NOT EXISTS idx_urls_active_partial
  ON public.urls (id)
  WHERE approved = true AND inactive = false;
