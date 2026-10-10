#!/usr/bin/env node
/**
 * verify-roam-rpc.mjs — regression guard for the roam() discovery RPC.
 *
 * WHY THIS EXISTS
 *   On 2026-08-03, roam() shipped with `array_agg(u.subcategory_id)` referencing
 *   a table alias that only existed inside a subquery aliased `t`. PL/pgSQL does
 *   not plan embedded SQL at CREATE FUNCTION time, so the migration applied
 *   cleanly and then threw 42P01 on *every* call for *every* user. The edge
 *   function turned that into a 404 and Android rendered it as "You've seen
 *   everything", so the outage was invisible in Sentry.
 *
 *   Static checks cannot catch this class of bug — only executing the function
 *   can. This script executes it.
 *
 * USAGE
 *   node scripts/verify-roam-rpc.mjs                  # audit real active users
 *   node scripts/verify-roam-rpc.mjs --user <uuid>    # check one specific user
 *   node scripts/verify-roam-rpc.mjs --limit 10       # widen the active-user sample
 *   node scripts/verify-roam-rpc.mjs --budget-ms 3000 # fail if slower than this
 *
 * EXIT CODES
 *   0 = every probed user received a URL within the latency budget
 *   1 = at least one user got an error, zero rows, or blew the budget
 *
 * NOTE: each probe performs one real roam() call, which counts as a served URL
 * for that user (same side effects as the user tapping "next"). In CI, point
 * --user at a dedicated test account.
 */

import { readFileSync } from 'node:fs';

// ── Config ──────────────────────────────────────────────────────────────────
function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line.trim());
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* .env is optional when vars come from CI secrets */ }
  return env;
}

const env = loadEnv();
const ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF =
  env.SUPABASE_PROJECT_REF ||
  (env.SUPABASE_URL ? new URL(env.SUPABASE_URL).hostname.split('.')[0] : null);

if (!ACCESS_TOKEN || !PROJECT_REF) {
  console.error('FAIL: SUPABASE_ACCESS_TOKEN and SUPABASE_URL (or SUPABASE_PROJECT_REF) are required.');
  process.exit(1);
}

// ── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const onlyUser = argOf('--user', null);
const limit = Number.parseInt(argOf('--limit', '5'), 10);
// 8000ms is not arbitrary: `authenticated` carries statement_timeout=8s
//   SELECT rolconfig FROM pg_roles WHERE rolname='authenticated';
// Anything slower than this cannot succeed for a logged-in user, no matter how
// fast an admin session appears to be.
const budgetMs = Number.parseInt(argOf('--budget-ms', '8000'), 10);


// ── SQL over the Management API ─────────────────────────────────────────────
async function sql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 600)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response: ${text.slice(0, 300)}`);
  }
}

const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// ── Static guard: the exact bug that caused the outage ──────────────────────
async function checkForKnownBadAlias() {
  const rows = await sql(`
    SELECT p.oid::text AS oid
    FROM   pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  p.proname = 'roam'
      AND  n.nspname = 'public'
      AND  pg_get_functiondef(p.oid) LIKE '%array_agg(u.subcategory_id)%'
  `);
  if (rows.length > 0) {
    console.error(`FAIL[static]: ${rows.length} roam() overload(s) still reference the out-of-scope alias "u".`);
    return false;
  }
  console.log('PASS[static]: no roam() overload references array_agg(u.subcategory_id)');
  return true;
}

// ── Pick users to probe ─────────────────────────────────────────────────────
async function pickUsers() {
  if (onlyUser) {
    if (!isUuid(onlyUser)) throw new Error(`--user must be a UUID, got: ${onlyUser}`);
    return [onlyUser];
  }
  const rows = await sql(`
    SELECT su.user_id::text AS user_id, count(*) AS seen
    FROM   seen_urls su
    GROUP  BY su.user_id
    ORDER  BY max(su.seen_at) DESC NULLS LAST
    LIMIT  ${Number.isFinite(limit) ? limit : 5}
  `);
  return rows.map((r) => r.user_id);
}

// ── Execute roam() as the user ──────────────────────────────────────────────
// LATERAL guarantees set_config() is evaluated before roam() is called, which a
// plain comma-join or CTE would not. roam() enforces auth.uid() = p_user_id, so
// the JWT claim must be in place first.
async function probe(userId) {
  const query = `
    SELECT r.n AS returned_rows, r.sample_url
    FROM (
      SELECT set_config('request.jwt.claims', json_build_object('sub', '${userId}')::text, true)
    ) cfg,
    LATERAL (
      SELECT count(*)::int AS n, min(url) AS sample_url
      FROM   roam('${userId}'::uuid)
    ) r
  `;
  const started = Date.now();
  try {
    const rows = await sql(query);
    const ms = Date.now() - started;
    const n = rows?.[0]?.returned_rows ?? 0;
    const sample = rows?.[0]?.sample_url ?? null;

    if (n < 1) {
      console.error(`FAIL ${userId}: roam() returned 0 rows in ${ms}ms (pool should never be empty)`);
      return false;
    }
    if (ms > budgetMs) {
      console.error(`FAIL ${userId}: ${n} row(s) but took ${ms}ms > budget ${budgetMs}ms — will hit statement timeouts under load`);
      return false;
    }
    console.log(`PASS ${userId}: ${n} row(s) in ${ms}ms -> ${sample}`);
    return true;
  } catch (e) {
    console.error(`FAIL ${userId}: roam() raised after ${Date.now() - started}ms -> ${e.message}`);
    return false;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`roam() RPC verification — project ${PROJECT_REF}, budget ${budgetMs}ms\n`);

  let ok = await checkForKnownBadAlias();

  const users = await pickUsers();
  if (users.length === 0) {
    console.error('FAIL: no users found to probe.');
    process.exit(1);
  }
  console.log(`\nProbing ${users.length} user(s):`);
  for (const u of users) {
    // Sequential on purpose — parallel probes distort the latency measurement.
    if (!(await probe(u))) ok = false;
  }

  console.log(ok ? '\nRESULT: PASS — discovery is healthy' : '\nRESULT: FAIL — discovery is broken');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
