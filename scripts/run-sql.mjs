import { readFileSync } from 'fs';
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

const migrationFile = process.argv[2] || 'supabase/migrations/20260616000000_badge_notification_deep_link.sql';
const sql = readFileSync(migrationFile, 'utf8');

console.log(`Running SQL migration: ${migrationFile}`);

async function run() {
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
  
  if (res.ok) {
    console.log('SQL executed successfully.');
    console.log(text.slice(0, 500));
  } else {
    console.error('SQL execution failed:', text.slice(0, 500));
    process.exit(1);
  }
}

run();