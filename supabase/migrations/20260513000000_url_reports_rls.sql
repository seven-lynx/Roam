-- =============================================================================
-- Enable RLS on url_reports (Task: security hardening)
-- =============================================================================
--
-- url_reports is an admin-only audit table. All writes originate from the
-- report-url Edge Function using the service role key, which bypasses RLS.
-- No public policies are required — enabling RLS alone makes the table
-- inaccessible to anon/authenticated roles via PostgREST (deny-by-default).
--
-- =============================================================================

ALTER TABLE public.url_reports ENABLE ROW LEVEL SECURITY;
