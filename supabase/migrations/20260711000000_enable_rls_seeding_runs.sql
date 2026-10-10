-- Migration: Enable RLS on seeding_runs
-- This table is only written to by scripts/sync-seeding-logs.mjs (service role),
-- so no policies are needed — the service role bypasses RLS.
ALTER TABLE public.seeding_runs ENABLE ROW LEVEL SECURITY;