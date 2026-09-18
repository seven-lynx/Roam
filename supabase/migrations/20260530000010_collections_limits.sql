-- Enforce per-user limits on saved URLs, collections, and collection items.
-- saved_urls:       max 50 per user; auto-evicts oldest on overflow
-- collections:      max 20 per user; raises exception on overflow
-- collection_items: max 200 per collection; raises exception on overflow
-- RLS:              add update/delete policies if not already present

-- ── saved_urls: auto-evict oldest when user exceeds 50 ────────────────────
CREATE OR REPLACE FUNCTION public.enforce_saved_urls_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.saved_urls
  WHERE user_id = NEW.user_id;

  IF v_count >= 50 THEN
    DELETE FROM public.saved_urls
    WHERE id = (
      SELECT id FROM public.saved_urls
      WHERE user_id = NEW.user_id
      ORDER BY saved_at ASC
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_saved_urls_limit ON public.saved_urls;
CREATE TRIGGER trg_saved_urls_limit
  BEFORE INSERT ON public.saved_urls
  FOR EACH ROW EXECUTE FUNCTION public.enforce_saved_urls_limit();

-- ── collections: max 20 per user ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_collections_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.collections WHERE user_id = NEW.user_id) >= 20 THEN
    RAISE EXCEPTION 'You can have at most 20 collections.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_collections_limit ON public.collections;
CREATE TRIGGER trg_collections_limit
  BEFORE INSERT ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.enforce_collections_limit();

-- ── collection_items: max 200 per collection ──────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_collection_items_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.collection_items WHERE collection_id = NEW.collection_id) >= 200 THEN
    RAISE EXCEPTION 'Collections can hold at most 200 items.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_collection_items_limit ON public.collection_items;
CREATE TRIGGER trg_collection_items_limit
  BEFORE INSERT ON public.collection_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_collection_items_limit();

-- ── RLS: ensure owners can update/delete their collections ────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'collections' AND policyname = 'collections: owner can update'
  ) THEN
    EXECUTE 'CREATE POLICY "collections: owner can update"
      ON public.collections FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'collections' AND policyname = 'collections: owner can delete'
  ) THEN
    EXECUTE 'CREATE POLICY "collections: owner can delete"
      ON public.collections FOR DELETE
      USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'collection_items' AND policyname = 'collection_items: owner can delete'
  ) THEN
    EXECUTE 'CREATE POLICY "collection_items: owner can delete"
      ON public.collection_items FOR DELETE
      USING (
        collection_id IN (
          SELECT id FROM public.collections WHERE user_id = auth.uid()
        )
      )';
  END IF;
END $$;
