-- Migration: seeding_runs table for tracking seeder execution history
-- Allows querying which seeders ran, when, and what they produced.

CREATE TABLE IF NOT EXISTS seeding_runs (
  id BIGSERIAL PRIMARY KEY,
  seeder TEXT NOT NULL,
  display_name TEXT,
  source TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  discovered INTEGER DEFAULT 0,
  inserted INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  dead INTEGER DEFAULT 0,
  redirects INTEGER DEFAULT 0,
  error TEXT,
  warnings TEXT[],
  duration_ms INTEGER,
  cache_bytes INTEGER,
  method TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seeding_runs_seeder ON seeding_runs(seeder);
CREATE INDEX IF NOT EXISTS idx_seeding_runs_started ON seeding_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_seeding_runs_source ON seeding_runs(source);