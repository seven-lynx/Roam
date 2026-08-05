#!/usr/bin/env node
/**
 * ===========================================================================
 * COMPREHENSIVE BADGE + XP/LEVEL REPAIR
 * ===========================================================================
 * Run: node scripts/repair-badges-comprehensive.mjs [--dry-run]
 *
 * Phase 1 (Management API SQL): Clean wipe of non-gift badges, clean
 *                badge_rewards XP, recalculate xp_total & level from
 *                remaining xp_log entries.
 * Phase 2 (HTTP): Call evaluate-badges edge function for every user,
 *                 awarding only badges they legitimately qualify for.
 * Phase 3 (Management API SQL): Sync profile badge counts & verify.
 *
 * This uses the Supabase Management API for SQL (HTTPS, no pg DNS needed)
 * and HTTP calls to the edge function for Phase 2 (canonical badging logic).
 * ===========================================================================
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
} catch {}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}
if (!SUPABASE_ACCESS_TOKEN) {
  console.error('ERROR: SUPABASE_ACCESS_TOKEN must be set in .env for Management API access');
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const MGMT_API = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/evaluate-badges`;

const BATCH_SIZE = 5;       // concurrent edge fn calls
const BATCH_DELAY_MS = 500; // delay between batches
const DRY_RUN = process.argv.includes('--dry-run');

// ============================================================================
// Helper: Execute SQL via Management API
// ============================================================================
async function execSQL(query, label) {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would execute SQL ${label ? `(${label})` : ''}`);
    return { rows: [], rowCount: 0 };
  }
  const resp = await fetch(MGMT_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`SQL error (${resp.status}): ${body.slice(0, 300)}`);
  }
  const data = await resp.json();
  return { rows: data, rowCount: Array.isArray(data) ? data.length : data.rows?.length ?? 0 };
}

// Helper: Get a single scalar value
async function getScalar(query, label) {
  const { rows } = await execSQL(query, label);
  if (Array.isArray(rows) && rows.length > 0) {
    return Object.values(rows[0])[0];
  }
  return null;
}

// ============================================================================
// Phase 1: Clean wipe via Management API SQL
// Each Management API call is an independent transaction so we use a single
// DO $$ block to atomically backup gift badges, wipe, restore, recalc XP/level.
// ============================================================================
async function phase1CleanWipe() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  PHASE 1: Clean Wipe (gift-safe)                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    // ---- Check current state ----
    const totalBadges = await getScalar('SELECT COUNT(*) FROM public.user_badges');
    const unlockedBadges = await getScalar("SELECT COUNT(*) FROM public.user_badges WHERE unlocked_at IS NOT NULL");
    const badgeXpEntries = await getScalar("SELECT COUNT(*) FROM public.xp_log WHERE action = 'badge_rewards'");
    const userCount = await getScalar('SELECT COUNT(*) FROM public.profiles');
    console.log(`Before: ${totalBadges} badge rows (${unlockedBadges} unlocked), ${badgeXpEntries} badge XP entries, ${userCount} users`);

    if (DRY_RUN) {
      console.log('[DRY RUN] Would backup gift badges and wipe non-gift data.');
      return { userCount: parseInt(userCount), dryRun: true };
    }

    // Single DO block: backup → wipe → restore → recalc XP → recalc level → reset counts → reset streaks
    console.log('\nRunning atomic clean-wipe...');
    const { rows } = await execSQL(`
      DO $$
      DECLARE
        gift_backup_count INT;
        deleted_badge_count INT;
        deleted_xp_count INT;
        xp_recalc_count INT;
        level_recalc_count INT;
        streak_reset_count INT;
      BEGIN
        -- Step 1: Backup gift badge assignments
        CREATE TEMP TABLE gift_badge_backup ON COMMIT DROP AS
        SELECT ub.*
        FROM public.user_badges ub
        JOIN public.badges b ON b.id = ub.badge_id
        WHERE b.is_gift_only = TRUE;
        GET DIAGNOSTICS gift_backup_count = ROW_COUNT;

        -- Step 2: Wipe ALL user_badges rows
        DELETE FROM public.user_badges;
        GET DIAGNOSTICS deleted_badge_count = ROW_COUNT;

        -- Step 3: Restore gift badge assignments
        INSERT INTO public.user_badges (user_id, badge_id, unlocked_at, progress_current, granted_by)
        SELECT user_id, badge_id, unlocked_at, progress_current, granted_by
        FROM gift_badge_backup;

        -- Step 4: Delete non-gift badge_rewards XP log entries
        DELETE FROM public.xp_log WHERE action = 'badge_rewards';
        GET DIAGNOSTICS deleted_xp_count = ROW_COUNT;

        -- Step 5: Recalculate xp_total from remaining xp_log entries
        WITH recalc AS (
          SELECT p.id, COALESCE(SUM(xl.xp_awarded), 0) AS new_xp
          FROM public.profiles p
          LEFT JOIN public.xp_log xl ON xl.user_id = p.id
          GROUP BY p.id
        )
        UPDATE public.profiles p SET xp_total = recalc.new_xp
        FROM recalc WHERE p.id = recalc.id AND p.xp_total IS DISTINCT FROM recalc.new_xp;
        GET DIAGNOSTICS xp_recalc_count = ROW_COUNT;

        -- Step 6: Recalculate level from xp_total
        UPDATE public.profiles SET level = FLOOR(SQRT(xp_total::NUMERIC / 100))::INT + 1
        WHERE level IS DISTINCT FROM FLOOR(SQRT(xp_total::NUMERIC / 100))::INT + 1;
        GET DIAGNOSTICS level_recalc_count = ROW_COUNT;

        -- Step 7: Reset badge_count to count remaining unlocked badges (gift only)
        WITH badge_counts AS (
          SELECT ub.user_id, COUNT(*)::INT AS actual_count
          FROM public.user_badges ub WHERE ub.unlocked_at IS NOT NULL
          GROUP BY ub.user_id
        )
        UPDATE public.profiles p SET badge_count = COALESCE(bc.actual_count, 0)
        FROM badge_counts bc WHERE p.id = bc.user_id AND p.badge_count IS DISTINCT FROM bc.actual_count;

        UPDATE public.profiles SET badge_count = 0
        WHERE badge_count != 0 AND NOT EXISTS (
          SELECT 1 FROM public.user_badges ub
          WHERE ub.user_id = profiles.id AND ub.unlocked_at IS NOT NULL
        );

        -- Step 8: Reset stale streaks
        PERFORM public.reset_stale_streaks();

        RAISE NOTICE 'gift_backup=% deleted_badges=% deleted_xp=% xp_recalc=% level_recalc=%',
          gift_backup_count, deleted_badge_count, deleted_xp_count, xp_recalc_count, level_recalc_count;
      END $$;
    `, 'clean-wipe-atomic');

    // Post-check
    const postBadges = await getScalar("SELECT COUNT(*) FROM public.user_badges WHERE unlocked_at IS NOT NULL");
    const postXp = await getScalar("SELECT COUNT(*) FROM public.xp_log WHERE action = 'badge_rewards'");
    console.log(`\nAfter: ${postBadges} gift-only badges unlocked, ${postXp} badge XP entries`);

    return { userCount: parseInt(userCount), dryRun: false };
  } catch (err) {
    console.error(`Phase 1 SQL Error: ${err.message}`);
    throw err;
  }
}

// ============================================================================
// Phase 2: Call edge function evaluate-badges for every user
// ============================================================================
async function phase2RebuildBadges(userCount) {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  PHASE 2: Rebuild Badges via Edge Function              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('[DRY RUN] Would call evaluate-badges for each user.');
    return { totalBadges: 0, ok: 0, fail: 0 };
  }

  // Fetch all user IDs (using Management API to list profiles)
  console.log('Fetching users...');
  const userListResp = await fetch(MGMT_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: 'SELECT id, username FROM public.profiles ORDER BY created_at ASC' }),
  });
  if (!userListResp.ok) {
    throw new Error(`Failed to fetch users: ${userListResp.status}`);
  }
  const userIds = await userListResp.json();
  console.log(`Found ${userIds.length} users to evaluate.\n`);

  let totalBadges = 0;
  let ok = 0;
  let fail = 0;
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(userIds.length / BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (user) => {
        const response = await fetch(EDGE_FN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ user_id: user.id }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`${response.status}: ${errText.slice(0, 100)}`);
        }

        const data = await response.json();
        return {
          username: user.username || user.id,
          awarded: data.awarded || 0,
          badges: data.badges || [],
        };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { username, awarded, badges } = result.value;
        if (awarded > 0) {
          console.log(`  OK    [${ok+fail+1}/${userIds.length}] ${username}: ${awarded} badge(s) — ${badges.join(', ')}`);
          totalBadges += awarded;
        }
        ok++;
      } else {
        console.error(`  FAIL  [${ok+fail+1}/${userIds.length}]: ${result.reason.message}`);
        fail++;
      }
    }

    // Progress summary every 5 batches
    if (batchNum % 5 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const pct = ((ok + fail) / userIds.length * 100).toFixed(1);
      console.log(`  --- Batch ${batchNum}/${totalBatches} | ${ok+fail}/${userIds.length} (${pct}%) | ${totalBadges} badges | ${elapsed}s ---`);
    }

    if (i + BATCH_SIZE < userIds.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log(`\nPhase 2 Complete: ${totalBadges} badges awarded | OK:${ok} Fail:${fail} | ${((Date.now()-startTime)/1000).toFixed(1)}s`);
  return { totalBadges, ok, fail };
}

// ============================================================================
// Phase 3: Sync badge counts & verify
// ============================================================================
async function phase3SyncCounts(userCount) {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  PHASE 3: Sync Badge Counts & Verify                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('[DRY RUN] Would fix badge counts and verify XP/level consistency.');
    return;
  }

  // Fix badge counts
  await execSQL(`
    WITH badge_counts AS (
      SELECT ub.user_id, COUNT(*)::INT AS actual_count
      FROM public.user_badges ub WHERE ub.unlocked_at IS NOT NULL
      GROUP BY ub.user_id
    )
    UPDATE public.profiles p
    SET badge_count = COALESCE(bc.actual_count, 0)
    FROM badge_counts bc
    WHERE p.id = bc.user_id
      AND p.badge_count IS DISTINCT FROM bc.actual_count
  `, 'fix badge counts');
  console.log('Fixed badge counts');

  // Zero-badge users
  await execSQL(`
    UPDATE public.profiles SET badge_count = 0
    WHERE badge_count != 0 AND NOT EXISTS (
      SELECT 1 FROM public.user_badges ub
      WHERE ub.user_id = profiles.id AND ub.unlocked_at IS NOT NULL
    )
  `, 'zero badge users');

  // ---- Verification: XP/Level consistency ----
  console.log('Verifying XP/level consistency...');
  const xpMismatch = await getScalar(`
    SELECT COUNT(*)
    FROM public.profiles p
    LEFT JOIN (SELECT user_id, SUM(xp_awarded) AS xp FROM public.xp_log GROUP BY user_id) xl_sum ON xl_sum.user_id = p.id
    WHERE p.xp_total IS DISTINCT FROM COALESCE(xl_sum.xp, 0)
  `);
  if (parseInt(xpMismatch) > 0) {
    console.log(`  ⚠ ${xpMismatch} profiles have XP drift. Realigning...`);
    await execSQL(`
      WITH recalc AS (
        SELECT p.id, COALESCE(SUM(xl.xp_awarded), 0) AS new_xp
        FROM public.profiles p LEFT JOIN public.xp_log xl ON xl.user_id = p.id
        GROUP BY p.id
      )
      UPDATE public.profiles p SET xp_total = recalc.new_xp
      FROM recalc WHERE p.id = recalc.id AND p.xp_total IS DISTINCT FROM recalc.new_xp
    `);
    console.log('  XP realigned');
  } else {
    console.log('  ✓ XP consistent');
  }

  // Level realignment
  const levelMismatch = await getScalar(`
    SELECT COUNT(*) FROM public.profiles
    WHERE level IS DISTINCT FROM FLOOR(SQRT(xp_total::NUMERIC / 100))::INT + 1
  `);
  if (parseInt(levelMismatch) > 0) {
    console.log(`  ⚠ ${levelMismatch} profiles have level drift. Fixing...`);
    await execSQL(`
      UPDATE public.profiles
      SET level = FLOOR(SQRT(xp_total::NUMERIC / 100))::INT + 1
      WHERE level IS DISTINCT FROM FLOOR(SQRT(xp_total::NUMERIC / 100))::INT + 1
    `);
    console.log('  Levels fixed');
  } else {
    console.log('  ✓ Levels consistent');
  }

  // Final stats
  const totalUsers = await getScalar('SELECT COUNT(*) FROM public.profiles');
  const usersWithBadges = await getScalar('SELECT COUNT(*) FROM public.profiles WHERE badge_count > 0');
  const totalBadges = await getScalar('SELECT SUM(badge_count) FROM public.profiles');
  const avgBadges = await getScalar('SELECT AVG(badge_count)::NUMERIC(5,1) FROM public.profiles');
  const avgXp = await getScalar('SELECT AVG(xp_total)::BIGINT FROM public.profiles');
  const avgLevel = await getScalar('SELECT AVG(level)::NUMERIC(5,1) FROM public.profiles');
  const maxLevel = await getScalar('SELECT MAX(level) FROM public.profiles');

  console.log(`\nFinal Stats:`);
  console.log(`  Users:           ${totalUsers}`);
  console.log(`  With badges:     ${usersWithBadges}`);
  console.log(`  Total badges:    ${totalBadges}`);
  console.log(`  Avg badges/user: ${avgBadges}`);
  console.log(`  Avg XP:          ${avgXp}`);
  console.log(`  Avg level:       ${avgLevel}`);
  console.log(`  Max level:       ${maxLevel}`);
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  console.log('=== ROAM: Comprehensive Badge + XP/Level Repair ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will modify data)'}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Edge Function: ${EDGE_FN_URL}\n`);

  if (!DRY_RUN) {
    console.log('⚠ This script will:');
    console.log('  1. Delete all non-gift badge assignments');
    console.log('  2. Delete all badge_rewards XP log entries');
    console.log('  3. Recalculate XP and level from scratch');
    console.log('  4. Re-award badges for ALL users via edge function');
    console.log('');
    console.log('Press Ctrl+C within 5 seconds to abort...');
    await new Promise(r => setTimeout(r, 5000));
    console.log('');
  }

  // Phase 1: Clean wipe
  const { userCount, dryRun } = await phase1CleanWipe();

  // Phase 2: Rebuild
  const rebuildResult = await phase2RebuildBadges(userCount);

  // Phase 3: Sync counts
  await phase3SyncCounts(userCount);

  if (DRY_RUN) {
    console.log('\n=== DRY RUN COMPLETE — no changes made ===');
  } else {
    console.log(`\n=== REPAIR COMPLETE: ${rebuildResult.totalBadges} badges | OK:${rebuildResult.ok} Fail:${rebuildResult.fail} ===`);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });