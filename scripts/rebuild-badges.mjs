#!/usr/bin/env node
/**
 * Rebuild: Award badges to all users by calling evaluate_badges() for each.
 * Run: node scripts/rebuild-badges.mjs
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
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('=== Badge Rebuild: Awarding badges to all users ===\n');
  const { data: users, error: usersError } = await supabase.from('profiles').select('id, username');
  if (usersError) { console.error('Failed to fetch users:', usersError.message); process.exit(1); }
  console.log(`Found ${users.length} users.\n`);

  let totalBadges = 0, totalXp = 0, ok = 0, fail = 0;
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    try {
      const { data, error } = await supabase.rpc('evaluate_badges', { p_user_id: user.id });
      if (error) { console.error(`  FAIL ${user.username}: ${error.message}`); fail++; }
      else {
        const count = data?.length || 0;
        if (count > 0) {
          const xp = data.reduce((s, b) => s + (b.xp_reward || 0), 0);
          console.log(`  [${i+1}/${users.length}] ${user.username}: ${count} badges (+${xp} XP)`);
          totalBadges += count; totalXp += xp;
        }
        ok++;
      }
    } catch (e) { console.error(`  FAIL ${user.username}: ${e.message}`); fail++; }
  }
  console.log(`\nDone: ${ok} OK, ${fail} fail | ${totalBadges} badges, ${totalXp} XP`);
}
main();