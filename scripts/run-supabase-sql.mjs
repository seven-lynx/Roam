#!/usr/bin/env node
/**
 * Run SQL against the live Supabase project using the Management API.
 * Works when DNS can't resolve Supabase domains (uses HTTPS API, not pg).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env from project root
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');
try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const value = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* .env not found */ }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: node scripts/run-supabase-sql.mjs <sql-file>');
  process.exit(1);
}

const sql = readFileSync(sqlFile, 'utf8');

async function run() {
  console.log(`Running SQL from: ${sqlFile} against project ${projectRef}`);

  // Option A: Use the Supabase REST API SQL endpoint (requires pgREST extension)
  // This is simpler and works without the Management API token
  const sqlUrl = `${SUPABASE_URL}/rest/v1/`;
  
  // Actually, we need to use the Supabase PostgREST /rpc endpoint or the SQL endpoint.
  // The simplest approach that always works: use the built-in `exec` via the Management API.
  
  if (SUPABASE_ACCESS_TOKEN) {
    // Management API approach
    console.log('Using Management API...');
    const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`Management API error (${resp.status}): ${body}`);
      process.exit(1);
    }
    console.log('SQL executed successfully via Management API.');
    return;
  }
  
  // Fallback: Print instructions
  console.error('SUPABASE_ACCESS_TOKEN not set in .env.');
  console.error('Add your Personal Access Token (PAT) to the .env file as:');
  console.error('  SUPABASE_ACCESS_TOKEN=sbp_...');
  console.error('Or run: npx supabase functions exec <function> ...');
  console.error('Or run it manually in the Supabase Dashboard SQL Editor:');
  console.error(`  https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.error('\nSQL to run:');
  console.error(sql);
  process.exit(1);
}

run().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});