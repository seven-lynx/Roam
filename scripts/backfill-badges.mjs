// Retroactively awards badges to all existing users by calling the
// fixed evaluate_badges RPC for each user in the profiles table.
// Uses service_role to bypass the auth.uid() check.
//
// Run: node scripts/backfill-badges.mjs

import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenvConfig({ path: resolve(ROOT, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

console.log('Fetching all users...');
const { data: users, error } = await supabase
  .from('profiles')
  .select('id, username');

if (error) {
  console.error('Failed to fetch users:', error.message);
  process.exit(1);
}

console.log(`Found ${users.length} users. Evaluating badges for each...`);

let totalBadgesAwarded = 0;
let successCount = 0;
let failCount = 0;

for (let i = 0; i < users.length; i++) {
  const user = users[i];
  try {
    const { data: badges, error: rpcError } = await supabase.rpc('evaluate_badges', {
      p_user_id: user.id,
    });

    if (rpcError) {
      console.error(`  FAIL  ${user.username || user.id}: ${rpcError.message}`);
      failCount++;
    } else {
      const count = badges?.length || 0;
      if (count > 0) {
        console.log(`  ${user.username || user.id}: ${count} badge(s) awarded`);
        totalBadgesAwarded += count;
      }
      successCount++;
    }
  } catch (err) {
    console.error(`  FAIL  ${user.username || user.id}: ${err instanceof Error ? err.message : err}`);
    failCount++;
  }

  // Small delay to avoid overwhelming the DB
  if (i % 10 === 0 && i > 0) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

console.log('---');
console.log(`Done. ${successCount} users processed, ${failCount} failed.`);
console.log(`Total badges retroactively awarded: ${totalBadgesAwarded}`);