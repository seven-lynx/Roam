#!/usr/bin/env node
/**
 * Badge Repair: Clean wipe + rebuild using Supabase client API.
 * 
 * Runs all steps in the migration via REST API calls using service_role key
 * (which bypasses RLS), then calls evaluate_badges() for every user.
 *
 * Run: node scripts/repair-badges.mjs
 */

import { createClient } from '@supabase/supabase-js';

import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenvConfig({ path: resolve(ROOT, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function execSQL(sql) {
  // Try exec_sql RPC first
  try {
    const { error } = await sb.rpc('exec_sql', { query: sql });
    if (!error) return { success: true };
    if (error.message && error.message.includes('Could not find the function')) {
      // exec_sql doesn't exist, try pgrest
    } else {
      throw error;
    }
  } catch (e) {
    // Fall through to pgrest
  }
  
  // Fallback: use pgrest SQL endpoint
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Prefer': 'params=single-object',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SQL execution failed: ${text.slice(0, 500)}`);
  }
  return { success: true };
}

async function main() {
  console.log('=== Badge Repair: Clean Wipe + Rebuild ===\n');

  // ── Phase 1: Wipe ────────────────────────────────────────────────────────

  console.log('Phase 1: Clean Wipe');

  // Step 1: Backup gift badges
  console.log('  Backing up gift badges...');
  const { data: giftBadges, error: giftErr } = await sb
    .from('user_badges')
    .select('*, badges!inner(is_gift_only)')
    .eq('badges.is_gift_only', true);
  
  if (giftErr) {
    console.error(`  ERROR backing up gift badges: ${giftErr.message}`);
    process.exit(1);
  }
  
  const giftBackup = (giftBadges || []).map(gb => ({
    user_id: gb.user_id,
    badge_id: gb.badge_id,
    unlocked_at: gb.unlocked_at,
    progress_current: gb.progress_current,
    granted_by: gb.granted_by,
  }));
  console.log(`  Backed up ${giftBackup.length} gift badge assignments`);

  // Step 2: Delete all user_badges
  console.log('  Deleting all user_badges...');
  const { error: delErr } = await sb.from('user_badges').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
  if (delErr) {
    console.error(`  ERROR deleting user_badges: ${delErr.message}`);
    process.exit(1);
  }

  // Step 3: Restore gift badges
  if (giftBackup.length > 0) {
    console.log(`  Restoring ${giftBackup.length} gift badges...`);
    const { error: restoreErr } = await sb.from('user_badges').insert(giftBackup);
    if (restoreErr) {
      console.error(`  ERROR restoring gift badges: ${restoreErr.message}`);
      process.exit(1);
    }
  }

  // Step 4: Delete badge_rewards XP log entries
  console.log('  Deleting badge_rewards XP...');
  const { error: xpDelErr } = await sb.from('xp_log').delete().eq('action', 'badge_rewards');
  if (xpDelErr) {
    console.error(`  ERROR deleting badge_rewards XP: ${xpDelErr.message}`);
    process.exit(1);
  }

  // Step 5-6: Recalculate xp_total and level (iterate users via REST API)
  console.log('  Recalculating xp_total and level...');
  const { data: xpUsers } = await sb.from('profiles').select('id');
  if (xpUsers) {
    for (const user of xpUsers) {
      const { data: xpRows } = await sb.from('xp_log').select('xp_awarded').eq('user_id', user.id);
      const totalXp = (xpRows || []).reduce((sum, r) => sum + r.xp_awarded, 0);
      const level = Math.floor(Math.sqrt(totalXp / 100)) + 1;
      await sb.from('profiles').update({ xp_total: totalXp, level }).eq('id', user.id);
    }
    console.log('  Recalculated xp_total and level for all users');
  }

  // Step 7: Recalculate badge_count from gift badges
  console.log('  Recalculating badge_count...');
  const { data: badgeCounts } = await sb.from('user_badges')
    .select('user_id')
    .not('unlocked_at', 'is', null);
  
  // Group by user_id
  const countMap = new Map();
  for (const bc of (badgeCounts || [])) {
    countMap.set(bc.user_id, (countMap.get(bc.user_id) || 0) + 1);
  }
  
  // Update all profiles
  const { data: allUsers } = await sb.from('profiles').select('id');
  if (allUsers) {
    for (const user of allUsers) {
      const newCount = countMap.get(user.id) || 0;
      const { data: profile } = await sb.from('profiles').select('badge_count').eq('id', user.id).single();
      if (profile && profile.badge_count !== newCount) {
        await sb.from('profiles').update({ badge_count: newCount }).eq('id', user.id);
      }
    }
    console.log('  Recalculated badge_count for all users');
  }

  // Step 8: Reset stale streaks
  console.log('  Resetting stale streaks...');
  try {
    const { data: resetResult } = await sb.rpc('reset_stale_streaks');
    console.log(`  Reset stale streaks done: ${resetResult} users affected`);
  } catch (e) {
    console.log(`  reset_stale_streaks RPC not available: ${e.message}`);
  }

  console.log('\nPhase 1 complete. Starting Phase 2: Rebuild...\n');
  await sleep(1000);

  // ── Phase 2: Rebuild ──────────────────────────────────────────────────────

  console.log('Phase 2: Award badges via evaluate_badges()');
  
  const { data: users, error: usersErr } = await sb.from('profiles').select('id, username');
  if (usersErr || !users) {
    console.error('Failed to fetch users:', usersErr?.message);
    process.exit(1);
  }

  console.log(`Processing ${users.length} users...\n`);

  let totalBadges = 0;
  let totalXp = 0;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    try {
      const { data: badges, error: rpcErr } = await sb.rpc('evaluate_badges', { p_user_id: user.id });
      if (rpcErr) {
        console.error(`  FAIL  [${i + 1}/${users.length}] ${user.username || user.id}: ${rpcErr.message}`);
        failed++;
      } else {
        const count = badges?.length || 0;
        if (count > 0) {
          const xpSum = badges.reduce((sum, b) => sum + (b.badge_xp_reward || 0), 0);
          console.log(`  OK    [${i + 1}/${users.length}] ${user.username || user.id}: ${count} badge(s) (+${xpSum} XP)`);
          totalBadges += count;
          totalXp += xpSum;
        }
        success++;
      }
    } catch (err) {
      console.error(`  FAIL  [${i + 1}/${users.length}] ${user.username || user.id}: ${err.message}`);
      failed++;
    }

    if ((i + 1) % 10 === 0 && i + 1 < users.length) {
      console.log(`  --- ${i + 1}/${users.length} processed (${totalBadges} badges so far) ---`);
      await sleep(200);
    }
  }

  // Final sync
  console.log('\nFinal sync of badge counts...');
  let synced = 0;
  for (const user of users) {
    try {
      await sb.rpc('sync_profile_badge_count', { p_user_id: user.id });
      synced++;
    } catch {
      // ignore
    }
  }

  console.log('\n=== Repair Complete ===');
  console.log(`Users processed: ${users.length}`);
  console.log(`Successful: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log(`Badges awarded: ${totalBadges}`);
  console.log(`XP awarded: ${totalXp}`);
  console.log(`Profiles synced: ${synced}`);
}

main().catch(err => {
  console.error(`\nFatal: ${err.message}`);
  process.exit(1);
});