import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenvConfig({ path: resolve(ROOT, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Use command-line argument if provided, otherwise default
const migrationFile = process.argv[2] || 'supabase/migrations/20260616000000_badge_notification_deep_link.sql';
const sql = readFileSync(migrationFile, 'utf8');

console.log(`Running migration: ${migrationFile}`);
(async () => {
  try {
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Error running migration:', err);
    process.exit(1);
  }
})();