#!/usr/bin/env node
/**
 * Run SQL directly against the Supabase PostgreSQL database using pg.
 * Uses the Supabase session pooler connection.
 */

import pg from 'pg';
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
} catch { /* .env not found, rely on system env vars */ }

// Build pooler connection from individual env vars
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const url = new URL(SUPABASE_URL);
const projectRef = url.hostname.split('.')[0];
// Use the direct database connection (not pooler) which is more reliable
const PG_CONN = `postgresql://postgres.${projectRef}:${encodeURIComponent(SUPABASE_SERVICE_ROLE_KEY)}@db.${projectRef}.supabase.co:5432/postgres`;

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: node scripts/direct-sql.mjs <sql-file>');
  process.exit(1);
}

const sql = readFileSync(sqlFile, 'utf8');

async function run() {
  console.log(`Running SQL from: ${sqlFile}`);
  
  const client = new pg.Client({ connectionString: PG_CONN, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('Connected to database.');
    
    const result = await client.query(sql);
    console.log('SQL executed successfully.');
    if (result.length > 0) {
      console.log(result);
    }
    if (result.rowCount != null) {
      console.log(`Rows affected: ${result.rowCount}`);
    }
  } catch (err) {
    console.error(`SQL Error: ${err.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});