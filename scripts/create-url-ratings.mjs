#!/usr/bin/env node
/**
 * Create url_ratings table if it doesn't exist.
 * Run: node scripts/create-url-ratings.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenvConfig({ path: resolve(ROOT, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const sql = `
CREATE TABLE IF NOT EXISTS public.url_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url_id UUID NOT NULL REFERENCES public.urls(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL DEFAULT 0 CHECK (rating IN (-1, 0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, url_id)
);
`;

(async () => {
  const { error } = await sb.rpc('exec_sql', { query: sql });
  if (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
  console.log('url_ratings table created successfully');
})();