-- =============================================================================
-- Moderation audit log (Task 2.15a)
-- =============================================================================
-- Tamper-proof record of every admin decision on the moderation queue.
-- A trigger on moderation_queue inserts a row here whenever `status` changes
-- away from 'pending'. RLS is admin-read-only; no UPDATE/DELETE policies are
-- defined, so even admins cannot rewrite history through PostgREST.
--
-- Idempotent: the table may already exist (created out-of-band before this
-- migration was authored); we ensure the final shape matches.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id    UUID        NOT NULL REFERENCES public.moderation_queue(id) ON DELETE CASCADE,
  admin_id    UUID                 REFERENCES auth.users(id)              ON DELETE SET NULL,
  decision    TEXT        NOT NULL CHECK (decision IN ('approved', 'rejected')),
  note        TEXT,
  decided_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reconcile columns in case an earlier hand-rolled version is missing any.
ALTER TABLE public.moderation_audit_log
  ADD COLUMN IF NOT EXISTS note       TEXT,
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_moderation_audit_log_queue
  ON public.moderation_audit_log (queue_id);
CREATE INDEX IF NOT EXISTS idx_moderation_audit_log_admin
  ON public.moderation_audit_log (admin_id, decided_at DESC);


-- ── Trigger: auto-log status transitions out of 'pending' ────────────────────
-- Runs as SECURITY DEFINER so the insert succeeds regardless of RLS on the
-- audit table. Only fires on real transitions (OLD.status = 'pending' AND
-- NEW.status IN ('approved','rejected')); other updates are ignored.
CREATE OR REPLACE FUNCTION public.log_moderation_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pending'
     AND NEW.status IN ('approved', 'rejected')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.moderation_audit_log (queue_id, admin_id, decision, note)
    VALUES (NEW.id, NEW.reviewed_by, NEW.status, NEW.reviewer_note);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_moderation_queue_audit ON public.moderation_queue;
CREATE TRIGGER trg_moderation_queue_audit
  AFTER UPDATE OF status ON public.moderation_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.log_moderation_decision();


-- ── RLS: admin-read-only ─────────────────────────────────────────────────────
ALTER TABLE public.moderation_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moderation_audit_log: admin can read" ON public.moderation_audit_log;
CREATE POLICY "moderation_audit_log: admin can read"
  ON public.moderation_audit_log FOR SELECT
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies: writes happen exclusively through the
-- SECURITY DEFINER trigger above. PostgREST clients (including admins) have
-- no path to mutate this table directly.
