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
 *   node scripts/verify-roam-rpc.mjs --json-out <path> # record this run's verdict per user
 *   node scripts/verify-roam-rpc.mjs --baseline <path> # tolerate failures recorded there
 *
 * BASELINE MODE
 *   deploy.yml runs this twice: before the migrations (advisory — it measures the
 *   function that is about to be replaced) and after them (blocking). A user whose
 *   roam() was already slow beforehand is not a migration regression, but without a
 *   baseline the blocking run cannot tell the difference and one such account
 *   freezes every Edge Function deploy (issue #118). Handing the pre-flight file to
 *   `--baseline` makes the post-migration run fail only on failures that are new,
 *   and re-probes that exact user set so the sample cannot drift between the runs.
 *   The static `array_agg(u.subcategory_id)` check always fails, baseline or not.
 *
 * EXIT CODES
 *   0 = every probed user received a URL within the latency budget
 *   1 = a user that was not already failing got an error, zero rows, or blew the budget
 *
 * NOTE: each probe performs one real roam() call, which counts as a served URL
 * for that user (same side effects as the user tapping "next"). In CI, point
 * --user at a dedicated test account.
 */

import { readFileSync, writeFileSync } from 'node:fs';

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
const jsonOut = argOf('--json-out', null);
const baselinePath = argOf('--baseline', null);


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

// ── Baseline: what was already failing before the migration ──────────────────
// A missing or unreadable file degrades to strict mode rather than passing by
// accident — that is the pre-#118 behaviour, so a broken baseline can never hide
// a migration that really did break discovery.
function loadBaseline(path) {
  if (!path) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const users = Array.isArray(raw.users) ? raw.users.filter((u) => isUuid(u.user_id)) : [];
    if (users.length === 0) {
      console.log(`Baseline at ${path} lists no users — strict mode.`);
      return null;
    }
    return {
      userIds: users.map((u) => u.user_id),
      failedUserIds: new Set(users.filter((u) => !u.ok).map((u) => u.user_id)),
    };
  } catch (e) {
    console.log(`No usable baseline at ${path} (${e.code || e.message}) — strict mode.`);
    return null;
  }
}

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
      return { user_id: userId, ok: false, rows: n, ms, sample_url: sample, reason: `roam() returned 0 rows in ${ms}ms (pool should never be empty)` };
    }
    if (ms > budgetMs) {
      return { user_id: userId, ok: false, rows: n, ms, sample_url: sample, reason: `${n} row(s) but took ${ms}ms > budget ${budgetMs}ms — will hit statement timeouts under load` };
    }
    return { user_id: userId, ok: true, rows: n, ms, sample_url: sample, reason: null };
  } catch (e) {
    const ms = Date.now() - started;
    return { user_id: userId, ok: false, rows: 0, ms, sample_url: null, reason: `roam() raised after ${ms}ms -> ${e.message}` };
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`roam() RPC verification — project ${PROJECT_REF}, budget ${budgetMs}ms\n`);

  const baseline = loadBaseline(baselinePath);
  if (baseline) {
    console.log(`Baseline ${baselinePath}: ${baseline.userIds.length} user(s), ${baseline.failedUserIds.size} already failing before the migration.\n`);
  }

  const staticOk = await checkForKnownBadAlias();

  // Re-probe the baseline's exact user set so the two runs are comparable; the
  // most-recently-seen sample can otherwise shift as real traffic arrives.
  const users = onlyUser
    ? [onlyUser]
    : baseline?.userIds.length
      ? baseline.userIds
      : await pickUsers();
  if (users.length === 0) {
    console.error('FAIL: no users found to probe.');
    process.exit(1);
  }
  console.log(`\nProbing ${users.length} user(s):`);

  const results = [];
  for (const u of users) {
    // Sequential on purpose — parallel probes distort the latency measurement.
    results.push(await probe(u));
  }

  let regression = !staticOk;
  for (const r of results) {
    if (r.ok) {
      console.log(`PASS ${r.user_id}: ${r.rows} row(s) in ${r.ms}ms -> ${r.sample_url}`);
    } else if (baseline?.failedUserIds.has(r.user_id)) {
      console.log(`TOLERATED ${r.user_id}: ${r.reason} — failed before the migration too`);
    } else {
      console.error(`FAIL ${r.user_id}: ${r.reason}`);
      regression = true;
    }
  }

  if (jsonOut) {
    // Written before the exit so the next step has a baseline even when this run fails.
    try {
      writeFileSync(jsonOut, `${JSON.stringify(
        { project: PROJECT_REF, budget_ms: budgetMs, static_ok: staticOk, generated_at: new Date().toISOString(), users: results },
        null,
        2,
      )}\n`);
      console.log(`\nWrote ${jsonOut}`);
    } catch (e) {
      console.error(`WARN: could not write ${jsonOut}: ${e.message}`);
    }
  }

  const tolerated = results.filter((r) => !r.ok).length;
  if (regression) {
    console.log('\nRESULT: FAIL — discovery is broken');
    process.exit(1);
  }
  console.log(tolerated
    ? `\nRESULT: PASS — discovery is healthy (${tolerated} pre-existing failure(s) tolerated)`
    : '\nRESULT: PASS — discovery is healthy');
  process.exit(0);
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
