#!/usr/bin/env node
/**
 * Deploy the fixed evaluate_badges function via Supabase SQL REST API.
 * The old function references public.url_ratings which doesn't exist.
 * This deploys the version with EXCEPTION WHEN undefined_table guards.
 */

import { readFileSync } from 'node:fs';
import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenvConfig({ path: resolve(ROOT, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const sql = readFileSync('supabase/migrations/20260730000001_fix_evaluate_badges_missing_url_ratings.sql', 'utf8');

async function deploy() {
  console.log('Deploying fixed evaluate_badges function...');

  // Try the pgrest SQL endpoint
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(text.slice(0, 500));
  if (res.ok) {
    console.log('Deployed successfully!');
  } else {
    console.log('Deploy may have failed — check output above');
  }
}

deploy().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});