-- ── Persist the interest mode and make interest saves atomic (issue #121) ──────
--
-- `user_categories` was the only record of what a user wants, so the *mode*
-- (pillars vs topics) was inferred from row shape: one row carrying a
-- `subcategory_id` flipped the whole picker into topics mode. Saving was
-- delete-all-then-insert across two PostgREST requests, so an aborted save left
-- zero rows (silently "the whole corpus" to `roam()`) or a partial set, and a
-- single unintended tap could narrow discovery to one subcategory — 41,968 URLs
-- over 198 domains, permanently exhausted (#118 is the cost of that state).
--
-- Three changes:
--   1. `user_settings.interest_mode` stores the choice. Backfilled from the exact
--      same rule the clients used to infer it, so nothing changes on deploy:
--      a user whose rows carry a `subcategory_id` is a topics user.
--   2. `replace_user_interests(mode, pillars, topics)` is the single writer for
--      both the rows and the mode — one transaction, so it cannot half-apply,
--      and it refuses an empty selection so "zero rows" is unreachable from a
--      client (that state used to mean "no filter at all").
--   3. "Everything" is a first-class choice: all eight pillars, which `roam()`
--      already reads as the whole pool. `roam()` itself is untouched — rows
--      remain the serving source of truth; the mode is presentation and a
--      write guard.

-- ── 1. The mode ───────────────────────────────────────────────────────────────

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS interest_mode TEXT NOT NULL DEFAULT 'pillars'
    CHECK (interest_mode IN ('pillars', 'topics'));

COMMENT ON COLUMN public.user_settings.interest_mode IS
  'Which interest picker the user chose: pillars (whole categories) or topics (specific subcategories). Persisted so the mode is never inferred from user_categories row shape.';

-- Backfill with the rule the clients inferred from: any topic-level row means
-- the user was in topics mode. Users with a settings row already get the value;
-- users without one get a row, because the default 'pillars' would otherwise
-- mislabel every existing topics user.
INSERT INTO public.user_settings (user_id, interest_mode)
SELECT uc.user_id, 'topics'
FROM public.user_categories uc
WHERE uc.subcategory_id IS NOT NULL
GROUP BY uc.user_id
ON CONFLICT (user_id) DO UPDATE
  SET interest_mode = 'topics'
  WHERE public.user_settings.interest_mode <> 'topics';

-- ── 2. The atomic writer ──────────────────────────────────────────────────────
--
-- SECURITY INVOKER on purpose: the existing owner-scoped RLS policies on
-- `user_categories` and `user_settings` stay the security boundary. The explicit
-- `auth.uid()` filters are belt-and-braces, not the gate.
--
-- Errors use ERRCODE 22023 (invalid_parameter_value) so PostgREST answers 400 and
-- the clients can surface the message verbatim.

CREATE OR REPLACE FUNCTION public.replace_user_interests(
  p_mode       TEXT,
  p_pillar_ids UUID[] DEFAULT NULL,
  p_topic_ids  UUID[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_mode       TEXT := lower(btrim(coalesce(p_mode, '')));
  v_pillar_ids UUID[] := coalesce(p_pillar_ids, '{}'::UUID[]);
  v_topic_ids  UUID[] := coalesce(p_topic_ids, '{}'::UUID[]);
  v_unknown    INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF v_mode NOT IN ('pillars', 'topics') THEN
    RAISE EXCEPTION 'Invalid interest mode: %', coalesce(p_mode, 'NULL')
      USING ERRCODE = '22023';
  END IF;

  -- Only the selected mode's list is written; the other is ignored rather than
  -- rejected, so a client carrying a stale copy of the inactive list still saves.
  IF v_mode = 'pillars' THEN
    v_topic_ids := '{}'::UUID[];
  ELSE
    v_pillar_ids := '{}'::UUID[];
  END IF;

  -- "Everything" is all eight pillars. An empty selection is not a state the
  -- database will store: zero rows means "no filter" to roam(), which is
  -- indistinguishable from "not set up yet" and was exactly the silent widening
  -- this issue is about.
  IF v_mode = 'pillars' AND coalesce(array_length(v_pillar_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Pick at least one category' USING ERRCODE = '22023';
  END IF;
  IF v_mode = 'topics' AND coalesce(array_length(v_topic_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Pick at least one topic' USING ERRCODE = '22023';
  END IF;

  -- Reject ids that do not exist before touching anything, so the FK violation
  -- never has to be the error a client sees.
  IF v_mode = 'pillars' THEN
    SELECT count(*) INTO v_unknown
    FROM unnest(v_pillar_ids) AS x(id)
    LEFT JOIN public.categories c ON c.id = x.id
    WHERE c.id IS NULL;
    IF v_unknown > 0 THEN
      RAISE EXCEPTION 'Unknown category in selection' USING ERRCODE = '22023';
    END IF;
  ELSE
    SELECT count(*) INTO v_unknown
    FROM unnest(v_topic_ids) AS x(id)
    LEFT JOIN public.subcategories sc ON sc.id = x.id
    WHERE sc.id IS NULL;
    IF v_unknown > 0 THEN
      RAISE EXCEPTION 'Unknown topic in selection' USING ERRCODE = '22023';
    END IF;
  END IF;

  DELETE FROM public.user_categories WHERE user_id = v_user_id;

  IF v_mode = 'pillars' THEN
    INSERT INTO public.user_categories (user_id, category_id, subcategory_id)
    SELECT DISTINCT v_user_id, x.id, NULL::UUID
    FROM unnest(v_pillar_ids) AS x(id);
  ELSE
    INSERT INTO public.user_categories (user_id, category_id, subcategory_id)
    SELECT DISTINCT v_user_id, sc.category_id, x.id
    FROM unnest(v_topic_ids) AS x(id)
    JOIN public.subcategories sc ON sc.id = x.id;
  END IF;

  -- Same transaction as the rows, so the mode can never disagree with them.
  INSERT INTO public.user_settings (user_id, interest_mode)
  VALUES (v_user_id, v_mode)
  ON CONFLICT (user_id) DO UPDATE
    SET interest_mode = EXCLUDED.interest_mode;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_user_interests(TEXT, UUID[], UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_user_interests(TEXT, UUID[], UUID[]) TO authenticated, service_role;

-- ── Rollback ──────────────────────────────────────────────────────────────────
-- Documented in RUNBOOK.md. Dropping the function and the column restores the
-- previous shape exactly: the backfill only ever wrote the mode the clients
-- already inferred, so reversing it loses no user data.

