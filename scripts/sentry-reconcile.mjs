#!/usr/bin/env node
/**
 * sentry-reconcile.mjs — find Sentry groups that have no live GitHub tracker.
 *
 * WHY THIS EXISTS
 *   Sentry's issue webhooks fire on state *changes* only (`created`, `resolved`,
 *   `assigned`, `archived`, `unresolved`). Two states therefore never reach
 *   GitHub, and neither is visible to `gh issue list --label sentry`, which only
 *   reads GitHub:
 *
 *     1. a group that has been `unresolved` since before the bridge existed never
 *        emits a `created` webhook — ROAM-ANDROID-P was first seen 2026-06-07 and
 *        carries 80 events with no tracker at all;
 *     2. a group whose tracker was closed while it stayed `unresolved` emits
 *        nothing afterwards, and because it was never *resolved* it can never
 *        become `regressed`, so the reopen path never runs either (#85).
 *
 *   This script compares both sides and, with `--file`, hands each drifted group
 *   to the existing bridge rather than re-implementing issue creation: the body it
 *   posts is the payload shape Sentry itself sends, so dedupe, labels, redaction,
 *   stack-trace enrichment and the reopen-a-closed-tracker decision all run
 *   exactly as they do for a live webhook.
 *
 * USAGE
 *   node scripts/sentry-reconcile.mjs                 # report only (default)
 *   node scripts/sentry-reconcile.mjs --check         # exit 1 when drift exists
 *   node scripts/sentry-reconcile.mjs --file          # post drifted groups
 *   node scripts/sentry-reconcile.mjs --project roam-android
 *   node scripts/sentry-reconcile.mjs --json          # machine-readable report
 *   node scripts/sentry-reconcile.mjs --file --webhook-url <url>
 *
 * REQUIRED ENV (root .env, or the environment in CI)
 *   SENTRY_AUTH_TOKEN        org-scoped read token for us.sentry.io
 *   GITHUB_TOKEN             optional; lifts the search API to 30 req/min
 *   SENTRY_WEBHOOK_SECRET    required by --file
 *   SUPABASE_URL             required by --file, unless --webhook-url is given
 *
 * EXIT CODES
 *   0 = nothing drifted (or drift found and repaired)
 *   1 = drift found under --check, or the run itself failed
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
  } catch { /* .env is optional when vars come from the environment */ }
  return env;
}

const env = loadEnv();

const SENTRY_API = env.SENTRY_API || 'https://us.sentry.io/api/0';
const SENTRY_ORG = env.SENTRY_ORG_SLUG || '7-lynx';
const GITHUB_REPO = env.GITHUB_REPO || 'seven-lynx/Roam';
const GITHUB_API = 'https://api.github.com';

// Every project the org reports into. A new project files issues on its own (the
// Sentry integration is org-wide), so it only has to be added here to be
// reconciled — nothing else changes.
const ALL_PROJECTS = ['roam-web', 'roam-supabase', 'roam-extension', 'roam-android'];

// ── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const boolArg = (name) => args.includes(name);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const FILE_MODE = boolArg('--file');
const CHECK_MODE = boolArg('--check');
const JSON_MODE = boolArg('--json');
const LIMIT = Number(argOf('--limit', '100'));
const PROJECTS = argOf('--project', '')
  ? [argOf('--project', '')]
  : ALL_PROJECTS;

const SENTRY_AUTH_TOKEN = env.SENTRY_AUTH_TOKEN;
if (!SENTRY_AUTH_TOKEN) {
  console.error('FAIL: SENTRY_AUTH_TOKEN is required.');
  process.exit(1);
}

const GITHUB_TOKEN = env.GITHUB_TOKEN || env.GH_TOKEN;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

// ── Sentry ──────────────────────────────────────────────────────────────────
async function sentryGet(path) {
  const res = await fetch(`${SENTRY_API}${path}`, {
    headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Sentry GET ${path} -> HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return { data: await res.json(), link: res.headers.get('link') || '' };
}

/**
 * The `cursor` of the next page in a Sentry `Link` header, or '' at the end.
 *
 * Sentry paginates through that header (not the body), and it also emits a
 * `rel="next"` entry with `results="false"` when the current page is the last
 * one — treating that as a next page re-requests the same cursor.
 */
function nextCursor(linkHeader) {
  for (const part of linkHeader.split(',')) {
    if (!/rel="next"/.test(part) || /results="false"/.test(part)) continue;
    const m = /cursor="([^"]+)"/.exec(part);
    if (m) return m[1];
  }
  return '';
}

/**
 * Every unresolved group in one project. `ignore`d groups are deliberately out of
 * scope: they are muted on purpose, and filing one would defeat the mute.
 */
async function listUnresolved(project) {
  const out = [];
  let cursor = '';
  for (let page = 0; page < 5; page += 1) {
    const query = `/projects/${SENTRY_ORG}/${project}/issues/?query=is:unresolved&limit=${LIMIT}`
      + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
    const { data, link } = await sentryGet(query);
    const batch = Array.isArray(data) ? data : [];
    out.push(...batch);
    cursor = nextCursor(link);
    if (!cursor) break;
  }
  return out;
}

// ── GitHub ──────────────────────────────────────────────────────────────────
/**
 * The tracking issue for a Sentry group, or null.
 *
 * Kept byte-identical to `searchQuery()` in
 * `supabase/functions/sentry-webhook/normalize.ts` — both keys have to agree there
 * (`label:sentry` plus the `[Sentry]` title prefix) because a hand-filed issue
 * that merely quotes the marker must not capture the slot. `sort=created&
 * order=asc` is equally load-bearing: GitHub scores search hits itself and breaks
 * ties arbitrarily.
 */
function searchQuery(sentryIssueId) {
  return `repo:${GITHUB_REPO} label:sentry type:issue in:title "[Sentry]" in:body "sentry-issue:${sentryIssueId}"`;
}

async function findTracker(sentryIssueId) {
  const q = encodeURIComponent(searchQuery(sentryIssueId));
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'roam-sentry-reconcile',
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

  const res = await fetch(`${GITHUB_API}/search/issues?q=${q}&sort=created&order=asc&per_page=5`, { headers });
  if (!res.ok) {
    // A failing search is not "no tracker": answering null here would file a
    // duplicate, which is the opposite of this script's job.
    throw new Error(`GitHub search -> HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const item = Array.isArray(data?.items) ? data.items[0] : null;
  return item ? { number: item.number, state: item.state } : null;
}

// ── The bridge ──────────────────────────────────────────────────────────────
function resolveWebhook() {
  const secret = env.SENTRY_WEBHOOK_SECRET;
  if (!secret) fail('SENTRY_WEBHOOK_SECRET is required by --file.');

  const explicit = argOf('--webhook-url', env.SENTRY_WEBHOOK_URL);
  const derived = env.SUPABASE_URL
    ? `${env.SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/sentry-webhook`
    : '';
  const url = explicit || derived;
  if (!url) fail('--file needs --webhook-url, SENTRY_WEBHOOK_URL or SUPABASE_URL.');
  return { url, secret };
}

/**
 * The payload Sentry posts on `action: created`, built from the REST issue object.
 * `normalizeIssueWebhook` reads exactly these keys, so the formatting, redaction
 * and dedupe all stay in one place (`normalize.ts:75`) instead of being copied here.
 */
function webhookPayload(issue) {
  return {
    action: 'created',
    data: {
      issue: {
        id: issue.id,
        title: issue.title,
        level: issue.level,
        platform: issue.platform,
        culprit: issue.culprit ?? null,
        metadata: issue.metadata ?? null,
        web_url: issue.permalink,
        project: { slug: issue.project?.slug },
        firstSeen: issue.firstSeen,
        lastSeen: issue.lastSeen,
        count: issue.count,
        userCount: issue.userCount,
        substatus: issue.substatus,
        status: issue.status,
      },
    },
  };
}

async function postToBridge(webhook, issue) {
  // Sentry sends the shared secret as a header; do the same so it stays out of
  // URLs, shell history and proxy logs.
  const res = await fetch(webhook.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sentry-webhook-secret': webhook.secret,
    },
    body: JSON.stringify(webhookPayload(issue)),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch { /* a non-JSON reply is reported verbatim below */ }
  return { status: res.status, body: parsed ?? text.slice(0, 300) };
}

// ── Report ──────────────────────────────────────────────────────────────────
function printTable(rows) {
  const head = ['PROJECT', 'SHORT ID', 'EVENTS', 'LAST SEEN', 'TRACKER', 'ACTION'];
  const body = rows.map((row) => [
    row.project,
    row.shortId ?? '—',
    String(row.group.count ?? '—'),
    // Sentry returns microsecond precision; the seconds are what matter here.
    String(row.group.lastSeen ?? '—').replace(/\.\d+Z$/, 'Z'),
    row.tracker ? `#${row.tracker.number} ${row.tracker.state}` : 'none',
    row.action,
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  console.log(line(head));
  console.log(line(widths.map((w) => '-'.repeat(w))));
  for (const b of body) console.log(line(b));
}

/**
 * A tracker that exists but is closed is drift too: the bridge reopens it on the
 * next webhook (`decideAction`), so handing it over restores the pairing instead
 * of filing a second issue for the same group.
 */
function describeAction(tracker) {
  if (!tracker) return 'file';
  return tracker.state === 'open' ? 'ok' : 'reopen';
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (FILE_MODE && CHECK_MODE) fail('--check and --file are mutually exclusive.');

  const webhook = FILE_MODE ? resolveWebhook() : null;
  if (!GITHUB_TOKEN && !JSON_MODE) {
    console.warn('note: GITHUB_TOKEN is unset - the search API is limited to 10 requests/minute.');
  }

  const rows = [];
  for (const project of PROJECTS) {
    for (const group of await listUnresolved(project)) {
      const tracker = await findTracker(group.id);
      rows.push({
        project,
        shortId: group.shortId,
        action: describeAction(tracker),
        tracker,
        group,
      });
    }
  }

  if (JSON_MODE) {
    console.log(JSON.stringify({
      rows: rows.map((row) => ({
        project: row.project,
        shortId: row.shortId,
        sentryId: String(row.group.id),
        title: row.group.title,
        level: row.group.level,
        events: row.group.count,
        lastSeen: row.group.lastSeen,
        tracker: row.tracker,
        action: row.action,
      })),
    }, null, 2));
  } else {
    printTable(rows);
  }

  const drift = rows.filter((row) => row.action !== 'ok');
  let failed = 0;

  if (FILE_MODE && drift.length > 0) {
    console.log(`\nHanding ${drift.length} drifted group(s) to the bridge...`);
    for (const row of drift) {
      const result = await postToBridge(webhook, row.group);
      const ok = result.status >= 200 && result.status < 300;
      console.log(`  ${row.shortId ?? row.group.id}: ${ok ? '' : `HTTP ${result.status} `}${JSON.stringify(result.body)}`);
      if (!ok) failed += 1;
    }
  }

  const counts = { ok: 0, file: 0, reopen: 0 };
  for (const row of rows) counts[row.action] += 1;
  console.log(
    `\n${rows.length} unresolved group(s): ${counts.ok} tracked, `
    + `${counts.file} without a tracker, ${counts.reopen} with a closed tracker.`,
  );
  if (!FILE_MODE && drift.length > 0) {
    console.log('Run with --file to file or reopen them through the bridge.');
  }

  if (failed > 0) process.exit(1);
  if (CHECK_MODE && drift.length > 0) process.exit(1);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
