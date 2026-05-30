-- Add a maintained item_count column to collections.
-- The counter is kept in sync by a trigger on collection_items.

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS item_count INT NOT NULL DEFAULT 0;

-- Backfill counts for any existing rows.
UPDATE public.collections c
SET item_count = (
  SELECT COUNT(*) FROM public.collection_items ci
  WHERE ci.collection_id = c.id
);

-- Function called by the trigger to increment or decrement the counter.
CREATE OR REPLACE FUNCTION public.update_collection_item_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.collections
    SET item_count = item_count + 1
    WHERE id = NEW.collection_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.collections
    SET item_count = GREATEST(item_count - 1, 0)
    WHERE id = OLD.collection_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_collection_item_count ON public.collection_items;
CREATE TRIGGER trg_collection_item_count
  AFTER INSERT OR DELETE ON public.collection_items
  FOR EACH ROW EXECUTE FUNCTION public.update_collection_item_count();
