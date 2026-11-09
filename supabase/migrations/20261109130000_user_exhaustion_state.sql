-- ============================================================================
-- Discovery exhaustion state: why roam() returned nothing, and when it lifts
-- ============================================================================
-- Issue #120. roam() signals exhaustion by returning zero rows and the edge
-- function maps that to 404 - but the body carries no reason, so "you have read
-- everything in scope" and "every domain you can see is cooling down" are
-- indistinguishable to all three clients. This table is where the reason is
-- persisted: roam() writes it on its zero-row path, the edge function reads it
-- back for the 404, and the notify cron drains it.
--
-- Why a table instead of a return column: roam() RETURNS TABLE, and CREATE OR
-- REPLACE cannot change a function's return type ("cannot change return type of
-- existing function"). Dropping and recreating it would drop its GRANT and
-- leave a window where a second overload can appear, so the reason is stored
-- beside the RPC rather than returned by it. v39 performs the write.
--
-- Nothing here is on the hot path: a row is written only when a *serve* (not a
-- prefetch) finds nothing, and record_exhaustion() debounces repeat detections.
-- ============================================================================

-- ── 1. State table ───────────────────────────────────────────────────────────
-- scope_key says which slice of discovery ran dry, in the same terms the client
-- sent: 'global', or '<kind>:<uuid>' for a category, subcategory or collection.
CREATE TABLE IF NOT EXISTS public.user_exhaustion_state (
  user_id           UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  scope_key         TEXT        NOT NULL,
  reason            TEXT        NOT NULL CHECK (reason IN ('pool_empty','cooldown','filters')),
  available_later   TIMESTAMPTZ DEFAULT NULL,
  detections        INT         NOT NULL DEFAULT 1,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_detected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at       TIMESTAMPTZ DEFAULT NULL,
  PRIMARY KEY (user_id, scope_key),
  CONSTRAINT user_exhaustion_state_scope_key_not_blank CHECK (scope_key <> ''),
  -- Only a cooldown has a time it lifts at; the other two reasons do not expire.
  CONSTRAINT user_exhaustion_state_available_later_needs_cooldown
    CHECK (available_later IS NULL OR reason = 'cooldown')
);

-- The notify cron scans for undrained state across all users.
CREATE INDEX IF NOT EXISTS idx_user_exhaustion_state_unnotified
  ON public.user_exhaustion_state (last_detected_at)
  WHERE notified_at IS NULL;

-- ── 2. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.user_exhaustion_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exhaustion_state: users can read own"
  ON public.user_exhaustion_state FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policy on purpose: the row is written only by
-- record_exhaustion() (SECURITY DEFINER, so it runs as the table owner and
-- bypasses RLS) and drained by the notify cron as service_role. A client must
-- not be able to claim another user is exhausted.

-- ── 3. The writer ────────────────────────────────────────────────────────────
-- Called by roam() on its zero-row path. p_user_id comes from roam()'s own
-- parameter, not from a client payload, which is why clients are not granted
-- EXECUTE on this function.
--
-- Debounce: a user who keeps retrying a genuinely dry scope must not accumulate
-- a write per attempt, so a repeat detection in the same 15 minutes only
-- refreshes last_detected_at. A *different* reason is new information: it
-- updates immediately and re-arms notification by clearing notified_at.
CREATE OR REPLACE FUNCTION public.record_exhaustion(
  p_user_id         UUID,
  p_scope_key       TEXT,
  p_reason          TEXT,
  p_available_later TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_scope_key IS NULL OR p_reason IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_exhaustion_state AS s
    (user_id, scope_key, reason, available_later)
  VALUES
    (p_user_id, p_scope_key, p_reason, p_available_later)
  ON CONFLICT (user_id, scope_key) DO UPDATE
     SET reason           = EXCLUDED.reason,
         available_later  = EXCLUDED.available_later,
         last_detected_at = now(),
         detections       = s.detections + 1,
         -- s.* is the pre-update row here, so this compares old reason to new.
         notified_at      = CASE
                              WHEN s.reason IS DISTINCT FROM EXCLUDED.reason THEN NULL
                              ELSE s.notified_at
                            END
   WHERE s.reason IS DISTINCT FROM EXCLUDED.reason
      OR s.last_detected_at < now() - INTERVAL '15 minutes';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_exhaustion(UUID, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
