#!/usr/bin/env node
/**
 * Seed challenges for all users — daily, weekly, and monthly.
 * Creates challenge_instances + user_challenges rows so the
 * challenges API endpoint returns real data immediately.
 *
 * Run: node scripts/seed-daily-challenges.mjs
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

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getUTCDate() { return new Date(); }

function getStartOfDayUTC(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function getEndOfDayUTC(date) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

function getStartOfNextWeekUTC(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function getStartOfNextMonthUTC(date) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function weightedRandomDraw(items, count) {
  if (items.length <= count) return [...items];
  const result = [];
  const available = items.map((item, idx) => ({ item, idx, weight: item.weight || 1 }));
  for (let i = 0; i < count; i++) {
    if (available.length === 0) break;
    const totalWeight = available.reduce((sum, a) => sum + a.weight, 0);
    let rand = Math.random() * totalWeight;
    let selectedIdx = 0;
    for (let j = 0; j < available.length; j++) {
      rand -= available[j].weight;
      if (rand <= 0) { selectedIdx = j; break; }
    }
    result.push(available[selectedIdx].item);
    available.splice(selectedIdx, 1);
  }
  return result;
}

async function main() {
  console.log('=== Seed Challenges: Daily + Weekly + Monthly ===\n');

  const now = getUTCDate();
  const todayStart = getStartOfDayUTC(now);
  const todayEnd = getEndOfDayUTC(now);
  const nextWeekStart = getStartOfNextWeekUTC(now);
  const nextMonthStart = getStartOfNextMonthUTC(now);

  // ── 1. Fetch challenge catalog ──────────────────────────────────────
  const { data: allChallenges, error: chalErr } = await sb
    .from('challenges')
    .select('*');

  if (chalErr || !allChallenges) {
    console.error('Failed to fetch challenges:', chalErr?.message);
    process.exit(1);
  }

  const daily = allChallenges.filter(c => c.challenge_type === 'daily');
  const weekly = allChallenges.filter(c => c.challenge_type === 'weekly');
  const monthly = allChallenges.filter(c => c.challenge_type === 'monthly');

  console.log(`Catalog: ${daily.length} daily, ${weekly.length} weekly, ${monthly.length} monthly`);

  // ── 2. Fetch profiles ──────────────────────────────────────────────
  const { data: profiles, error: profErr } = await sb
    .from('profiles')
    .select('id, username');

  if (profErr || !profiles) {
    console.error('Failed to fetch profiles:', profErr?.message);
    process.exit(1);
  }

  console.log(`Profiles: ${profiles.length}\n`);

  // ── 3. Delete existing instances (clean start) ──────────────────────
  const { error: delErr } = await sb
    .from('challenge_instances')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (delErr) {
    console.error('Failed to delete existing instances:', delErr.message);
  } else {
    console.log('Cleared existing challenge instances');
  }

  let totalDaily = 0, totalWeekly = 0, totalMonthly = 0;

  // ── 4. Create daily challenges (per-user) ───────────────────────────
  console.log('\n--- Daily Challenges ---');
  for (const profile of profiles) {
    const drawn = weightedRandomDraw(daily, 2);
    for (const challenge of drawn) {
      const { data: instance, error: instErr } = await sb
        .from('challenge_instances')
        .insert({
          challenge_id: challenge.id,
          challenge_type: 'daily',
          starts_at: todayStart,
          expires_at: todayEnd,
          is_global: false,
        })
        .select('id')
        .single();

      if (instErr || !instance) {
        console.error(`  FAIL instance for ${profile.username}: ${instErr?.message}`);
        continue;
      }

      const { error: ucErr } = await sb
        .from('user_challenges')
        .insert({
          user_id: profile.id,
          instance_id: instance.id,
          progress_current: 0,
        });

      if (ucErr) {
        console.error(`  FAIL user_challenge for ${profile.username}: ${ucErr.message}`);
      } else {
        totalDaily++;
      }
    }
  }
  console.log(`  Created ${totalDaily} daily user_challenges`);

  // ── 5. Create weekly challenges (global, per-user) ──────────────────
  console.log('\n--- Weekly Challenges ---');
  const weeklyDrawn = weightedRandomDraw(weekly, 3);
  for (const challenge of weeklyDrawn) {
    const { data: instance, error: instErr } = await sb
      .from('challenge_instances')
      .insert({
        challenge_id: challenge.id,
        challenge_type: 'weekly',
        starts_at: todayStart,
        expires_at: nextWeekStart,
        is_global: true,
      })
      .select('id')
      .single();

    if (instErr || !instance) {
      console.error(`  FAIL weekly instance: ${instErr?.message}`);
      continue;
    }

    for (const profile of profiles) {
      const { error: ucErr } = await sb
        .from('user_challenges')
        .insert({
          user_id: profile.id,
          instance_id: instance.id,
          progress_current: 0,
        });

      if (ucErr) {
        console.error(`  FAIL weekly uc for ${profile.username}: ${ucErr.message}`);
      } else {
        totalWeekly++;
      }
    }
  }
  console.log(`  Created ${totalWeekly} weekly user_challenges`);

  // ── 6. Create monthly challenges (global, per-user) ─────────────────
  console.log('\n--- Monthly Challenges ---');
  const monthlyDrawn = weightedRandomDraw(monthly, 3);
  for (const challenge of monthlyDrawn) {
    const { data: instance, error: instErr } = await sb
      .from('challenge_instances')
      .insert({
        challenge_id: challenge.id,
        challenge_type: 'monthly',
        starts_at: todayStart,
        expires_at: nextMonthStart,
        is_global: true,
      })
      .select('id')
      .single();

    if (instErr || !instance) {
      console.error(`  FAIL monthly instance: ${instErr?.message}`);
      continue;
    }

    for (const profile of profiles) {
      const { error: ucErr } = await sb
        .from('user_challenges')
        .insert({
          user_id: profile.id,
          instance_id: instance.id,
          progress_current: 0,
        });

      if (ucErr) {
        console.error(`  FAIL monthly uc for ${profile.username}: ${ucErr.message}`);
      } else {
        totalMonthly++;
      }
    }
  }
  console.log(`  Created ${totalMonthly} monthly user_challenges`);

  // ── 7. Summary ──────────────────────────────────────────────────────
  console.log('\n=== Seed Complete ===');
  console.log(`Daily:   ${totalDaily} rows (${profiles.length} users × 2 challenges)`);
  console.log(`Weekly:  ${totalWeekly} rows (${profiles.length} users × ${weeklyDrawn.length} challenges)`);
  console.log(`Monthly: ${totalMonthly} rows (${profiles.length} users × ${monthlyDrawn.length} challenges)`);
  console.log(`Total:   ${totalDaily + totalWeekly + totalMonthly} user_challenges`);
}

main().catch(err => {
  console.error(`\nFatal: ${err.message}`);
  process.exit(1);
});