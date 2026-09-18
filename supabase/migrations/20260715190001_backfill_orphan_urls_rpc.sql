-- backfill_orphan_urls_rpc.sql
-- Server-side RPC function to backfill orphan URLs in bulk.
-- Called via supabase.rpc('backfill_orphan_urls')
-- Uses extended statement_timeout (10 minutes) since these updates touch
-- up to 21K rows per source and need to operate without an index on
-- (source, approved, subcategory_id).

DROP FUNCTION IF EXISTS public.backfill_orphan_urls();

CREATE OR REPLACE FUNCTION public.backfill_orphan_urls()
RETURNS TABLE (_source text, _updated_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '600s'
AS $$
DECLARE
  m RECORD;
BEGIN
  FOR m IN (
    SELECT s.source AS src, s.subcategory_id
    FROM (VALUES
      ('openlibrary',        'c2000003-0000-0000-0000-000000000005'::uuid),
      ('ted',                'c2000004-0000-0000-0000-000000000002'::uuid),
      ('wikivoyage',         'c2000007-0000-0000-0000-000000000001'::uuid),
      ('gutenberg',          'c2000003-0000-0000-0000-000000000005'::uuid),
      ('hackernews',         'c2000002-0000-0000-0000-000000000001'::uuid),
      ('reddit',             'c2000002-0000-0000-0000-000000000006'::uuid),
      ('marginalia',         'c2000002-0000-0000-0000-000000000006'::uuid),
      ('hn-ask',             'c2000002-0000-0000-0000-000000000006'::uuid),
      ('atlantic',           'c2000004-0000-0000-0000-000000000002'::uuid),
      ('newyorker',          'c2000004-0000-0000-0000-000000000002'::uuid),
      ('semanticscholar',    'c2000001-0000-0000-0000-000000000002'::uuid),
      ('cloudhiker',         'c2000006-0000-0000-0000-000000000003'::uuid),
      ('wiby',               'c2000006-0000-0000-0000-000000000008'::uuid),
      ('smithsonian-news',   'c2000004-0000-0000-0000-000000000002'::uuid),
      ('longform',           'c2000003-0000-0000-0000-000000000005'::uuid),
      ('nasa',               'c2000001-0000-0000-0000-000000000001'::uuid),
      ('atlas-obscura-places','c2000006-0000-0000-0000-000000000003'::uuid)
    ) AS s(source, subcategory_id)
  )
  LOOP
    WITH updated AS (
      UPDATE public.urls
      SET subcategory_id = m.subcategory_id
      WHERE source = m.src
        AND approved = true
        AND subcategory_id IS NULL
      RETURNING id
    )
    SELECT m.src, count(*)::int INTO _source, _updated_count
    FROM updated;

    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.backfill_orphan_urls() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.backfill_orphan_urls() TO service_role;