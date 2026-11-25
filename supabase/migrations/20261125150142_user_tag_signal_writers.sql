-- =============================================================================
-- Roam - user tag weights: the writers (tag-rollout segment T10)
-- =============================================================================
-- `user_tag_weights` has existed since 20261008000000 with RLS enabled and an
-- owner-read policy, but nothing ever wrote to it. This migration gives it three
-- writers, all of them explicit signal (D4): a rating, a save and a share.
-- `seen_urls` stays out on purpose - a served URL is not a viewed one, and
-- feeding serves back would build the echo chamber the profile is meant to avoid.
--
-- Shape: one SECURITY DEFINER function does the arithmetic, one small trigger
-- function per source table calls it. The arithmetic spreads a delta evenly over
-- the URL's tags, so a one-tag URL moves that tag by the full delta and a
-- four-tag URL moves each tag by a quarter. Weights are floored at 0 (a downvote
-- can erase a tag's weight but never make it negative). `signal_count` counts
-- every explicit action - that is what lets user_tag_weight_map() tighten the
-- multiplier clamp for a user who has barely acted yet.
--
-- RLS: no new policy. `user_tag_weights` keeps its owner-read SELECT policy
-- (20261008000000_tag_graph_schema.sql:214-216) and gains no write policy, so a
-- client can read its own weights and can only move them through these triggers.
--
-- Rollback: see RUNBOOK.md -> 20261125150142_user_tag_signal_writers.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION public.user_tag_signal(
  p_user  UUID,
  p_url   UUID,
  p_delta NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag_count NUMERIC;
BEGIN
  -- A saved URL may carry no url_id (saved_urls.url_id is nullable and the
  -- clients can store a bare url), and a zero delta is a no-op. Both are normal.
  IF p_user IS NULL OR p_url IS NULL OR p_delta IS NULL OR p_delta = 0 THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_tag_count FROM public.url_tags WHERE url_id = p_url;

  -- An untagged URL teaches the profile nothing. That is the common case for the
  -- 20.99 % of the corpus the tagger left empty (tag-qa-2026-11-24.md, row 2).
  IF v_tag_count = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.user_tag_weights (user_id, tag_id, weight, signal_count)
  SELECT p_user, ut.tag_id, p_delta / v_tag_count, 1
  FROM public.url_tags ut
  WHERE ut.url_id = p_url
  ON CONFLICT (user_id, tag_id) DO UPDATE
    SET weight       = greatest(0, public.user_tag_weights.weight + EXCLUDED.weight),
        signal_count = public.user_tag_weights.signal_count + 1;
END;
$$;

COMMENT ON FUNCTION public.user_tag_signal(UUID, UUID, NUMERIC) IS
  'Spreads one explicit signal (rating/save/share delta) over the URL''s tags and upserts user_tag_weights. SECURITY DEFINER so the trigger path can write past the owner-read-only RLS policy; deliberately not executable by clients.';

REVOKE ALL ON FUNCTION public.user_tag_signal(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_tag_signal(UUID, UUID, NUMERIC) TO service_role;

-- ── ratings: a value of 1 or -1 on a unique (user_id, url_id) pair ────────────
-- An update is a delta, not a second vote: `new.value - old.value` is 2 when a
-- downvote is changed to an upvote and -2 the other way. A row whose user or url
-- changed (the app never does that, the table allows it) is reversed first and
-- re-applied, so the weights always describe the current pair.
CREATE OR REPLACE FUNCTION public.ratings_tag_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.user_tag_signal(NEW.user_id, NEW.url_id, NEW.value);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.user_tag_signal(OLD.user_id, OLD.url_id, -OLD.value);
  ELSIF NEW.user_id = OLD.user_id AND NEW.url_id = OLD.url_id THEN
    PERFORM public.user_tag_signal(NEW.user_id, NEW.url_id, NEW.value - OLD.value);
  ELSE
    PERFORM public.user_tag_signal(OLD.user_id, OLD.url_id, -OLD.value);
    PERFORM public.user_tag_signal(NEW.user_id, NEW.url_id, NEW.value);
  END IF;
  RETURN NULL;
END;
$$;

-- ── saved_urls: +1 on insert, -1 on delete ───────────────────────────────────
-- No update branch: the unique index is on (user_id, url), the row carries no
-- mutable signal, and a NULL url_id (a bare url saved before the URL was in the
-- corpus) is skipped by user_tag_signal itself.
CREATE OR REPLACE FUNCTION public.saved_urls_tag_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.user_tag_signal(NEW.user_id, NEW.url_id, 1);
  ELSE
    PERFORM public.user_tag_signal(OLD.user_id, OLD.url_id, -1);
  END IF;
  RETURN NULL;
END;
$$;

-- ── share_events: +2 for a shared URL, -2 when the share is removed ──────────
-- Shares weigh double because they are the most deliberate action of the three.
-- `share_events.user_id` references `profiles(id)` (20260731000001:6) and
-- `profiles.id` references `auth.users(id)` (20260423000000_initial.sql:54), so
-- the id is the same user id `user_tag_weights` keys on - no mapping needed.
-- Collection and profile shares carry no url_id and are ignored.
CREATE OR REPLACE FUNCTION public.share_events_tag_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.share_type = 'url' THEN
    PERFORM public.user_tag_signal(NEW.user_id, NEW.url_id, 2);
  ELSIF TG_OP = 'DELETE' AND OLD.share_type = 'url' THEN
    PERFORM public.user_tag_signal(OLD.user_id, OLD.url_id, -2);
  END IF;
  RETURN NULL;
END;
$$;

-- The signal is applied after the row is written, so a rolled-back action rolls
-- its weight back with it. The three trigger functions are never callable as SQL
-- (PostgreSQL refuses to run a trigger function outside a trigger), and the
-- EXECUTE revoke states that rather than relying on it.
REVOKE ALL ON FUNCTION public.ratings_tag_signal()      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.saved_urls_tag_signal()   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.share_events_tag_signal() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_ratings_tag_signal ON public.ratings;
CREATE TRIGGER trg_ratings_tag_signal
  AFTER INSERT OR UPDATE OR DELETE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.ratings_tag_signal();

DROP TRIGGER IF EXISTS trg_saved_urls_tag_signal ON public.saved_urls;
CREATE TRIGGER trg_saved_urls_tag_signal
  AFTER INSERT OR DELETE ON public.saved_urls
  FOR EACH ROW EXECUTE FUNCTION public.saved_urls_tag_signal();

DROP TRIGGER IF EXISTS trg_share_events_tag_signal ON public.share_events;
CREATE TRIGGER trg_share_events_tag_signal
  AFTER INSERT OR DELETE ON public.share_events
  FOR EACH ROW EXECUTE FUNCTION public.share_events_tag_signal();

