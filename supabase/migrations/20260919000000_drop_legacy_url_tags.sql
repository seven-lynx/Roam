-- =============================================================================
-- Roam — Retire the legacy url_tags table
-- =============================================================================
-- The legacy tagging system created public.url_tags with a TEXT `tag` column:
--   (id, url_id, tag TEXT, tagged_by, created_at)
-- It is superseded by the tag-graph url_tags (url_id UUID, tag_id UUID,
-- confidence, source) created in 20261008000000_tag_graph_schema.sql.
--
-- The legacy table has no consumers anywhere in the codebase, so it is dropped
-- here to free the name before the tag-graph migration runs. Without this, the
-- tag-graph migration's CREATE TABLE public.url_tags aborts on a name clash.
--
-- Rollback: restore from the point-in-time backup taken before this migration.
-- The legacy table held no live data referenced by the application.
-- =============================================================================

DO $$
BEGIN
  -- Only drop the LEGACY table, identified by its TEXT `tag` column. The guard
  -- makes this safe to re-run and prevents dropping the new tag-graph table if
  -- migrations were ever applied out of order.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'url_tags'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'url_tags'
      AND column_name = 'tag'
      AND data_type = 'text'
  ) THEN
    DROP TABLE public.url_tags;
  END IF;
END $$;
