-- =============================================================================
-- Fix moderation: drop the legacy audit trigger that breaks service-role
-- moderation (the admin-moderation Edge Function used by the Android app).
--
-- Background:
--   - 20260424000000_schema_improvements.sql created trg_moderation_audit_log
--     -> fn_moderation_audit_log(), which sets moderation_audit_log.admin_id
--     from auth.uid() and declared admin_id NOT NULL.
--   - 20260501000001_moderation_audit_log.sql later added the superseding
--     trg_moderation_queue_audit -> log_moderation_decision(), which records
--     admin_id from NEW.reviewed_by (and also stores the reviewer note).
--
--   Both triggers fire on moderation_queue.status updates, so web moderation
--   (user JWT) writes two audit rows, and the admin-moderation Edge Function
--   (service role, no authenticated user) fails because auth.uid() is NULL,
--   violating admin_id NOT NULL. Dropping the legacy trigger fixes both.
-- =============================================================================

DROP TRIGGER IF EXISTS trg_moderation_audit_log ON public.moderation_queue;
DROP FUNCTION IF EXISTS public.fn_moderation_audit_log();

-- Defensive: align admin_id with the intended (nullable) schema so a future
-- service-role update that omits reviewed_by doesn't fail again.
ALTER TABLE public.moderation_audit_log ALTER COLUMN admin_id DROP NOT NULL;
