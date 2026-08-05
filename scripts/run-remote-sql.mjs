#!/usr/bin/env node
/**
 * Run SQL on the remote database via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN in .env
 */

import { readFileSync } from 'node:fs';

import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenvConfig({ path: resolve(ROOT, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';
const PROJECT_REF = 'yrhckctwtdjowulfuaqc';

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: node scripts/run-remote-sql.mjs <sql-file>');
  process.exit(1);
}

const sql = readFileSync(sqlFile, 'utf8');

async function run() {
  console.log(`Running SQL from: ${sqlFile}`);

  // Method 1: Management API with access token
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  console.log(`Management API Status: ${res.status}`);
  
  if (res.ok) {
    console.log('SQL executed successfully');
    console.log(text.slice(0, 500));
    return;
  }

  console.log(`Management API failed: ${text.slice(0, 300)}`);

  // Method 2: Try the REST SQL endpoint with service role key
  console.log('\nTrying REST SQL endpoint...');
  const res2 = await fetch(`${SUPABASE_URL}/rest/v1/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  const text2 = await res2.text();
  console.log(`REST SQL Status: ${res2.status}`);
  console.log(text2.slice(0, 500));
}

run().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});