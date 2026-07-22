-- =============================================================================
-- Report toolkit support indexes
-- =============================================================================
-- Adds 3 indexes to speed up the periodic report scripts without impacting
-- the production hot path (all use CREATE INDEX CONCURRENTLY-compatible patterns).
-- =============================================================================

-- 1. Pending queue aging report (C1): fast lookup of unresolved submissions
--    ordered by age. Uses partial index on status='pending' to keep it small.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moderation_queue_pending_age
  ON public.moderation_queue (created_at)
  WHERE status = 'pending';

-- 2. Source contribution breakdown (A4): GROUP BY source WHERE approved = true
--    Composite covering index avoids heap fetches.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_urls_source_approved
  ON public.urls (source, approved)
  WHERE approved = true;

-- 3. Subcategory deep-dive (A3): GROUP BY subcategory_id joined to categories.
--    Partial index on approved=true URLs for fast aggregation.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_urls_subcategory_approved
  ON public.urls (subcategory_id)
  WHERE approved = true;