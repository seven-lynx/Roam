/**
 * check-dead-urls.mjs — Batch dead-link and redirect checker
 *
 * Workflow (3 phases):
 *   Phase 1 – Export   SELECT id, url, source FROM urls WHERE approved=TRUE AND inactive=FALSE
 *                       Streams to .cache/dead-links-export.jsonl  (skipped if cache exists)
 *   Phase 2 – Check    HEAD each URL; follow redirects manually; classify alive/dead/redirect
 *                       Appends to .cache/dead-links-results.jsonl  (resumable via checkpoint)
 *   Phase 3 – Commit   Batch UPDATE inactive=TRUE for dead URLs; UPDATE url for same-domain
 *                       redirects.  Only runs when --commit is passed.
 *
 * Usage:
 *   node scripts/check-dead-urls.mjs [options]
 *
 * Options:
 *   --dry-run          (default) Export + check only; no DB writes
 *   --commit           Write results to Supabase
 *   --source <name>    Scope export to one source (e.g. --source reddit)
 *   --limit <n>        Check only first N URLs from export (testing)
 *   --concurrency <n>  Parallel request slots (default: 20)
 *   --re-export        Re-download URL list even if cache exists
 *   --reset            Delete checkpoint and result files; re-run phase 2 from scratch
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import {
  createWriteStream, existsSync, mkdirSync,
  readFileSync, writeFileSync, appendFileSync, unlinkSync,
} from 'fs';
import fetch from 'node-fetch';
import { config as dotenvConfig } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const EXPORT_FILE    = resolve(CACHE_DIR, 'dead-links-export.jsonl');
const RESULTS_FILE   = resolve(CACHE_DIR, 'dead-links-results.jsonl');
const PROGRESS_FILE  = resolve(CACHE_DIR, 'dead-links-progress.json');

dotenvConfig({ path: resolve(__dirname, '../.env') });

// ── CLI flags ────────────────────────────────────────────────────────────────
const COMMIT      = process.argv.includes('--commit');
const RE_EXPORT   = process.argv.includes('--re-export');
const RESET       = process.argv.includes('--reset');

const SOURCE_ARG = (() => {
  const i = process.argv.indexOf('--source');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const LIMIT_ARG = (() => {
  const i = process.argv.indexOf('--limit');
  return i >= 0 ? Math.max(1, parseInt(process.argv[i + 1], 10)) : null;
})();
const CONCURRENCY = (() => {
  const i = process.argv.indexOf('--concurrency');
  return i >= 0 ? Math.max(1, parseInt(process.argv[i + 1], 10)) : 20;
})();

// ── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── Constants ────────────────────────────────────────────────────────────────
const TIMEOUT_MS     = 8_000;
const MAX_RETRIES    = 3;
const MAX_REDIRECTS  = 5;
const DB_BATCH_SIZE  = 500;
const EXPORT_PAGE_SIZE = 1_000;
const DOMAIN_DELAY_MS  = 100;  // max 10 req/s per domain

// ── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function normaliseUrl(url) {
  try {
    const u = new URL(url);
    u.protocol = 'https:';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    u.hash = '';
    return u.toString();
  } catch { return url; }
}

function isSameDomainRedirect(originalUrl, finalUrl) {
  try {
    const origHost = new URL(originalUrl).hostname.replace(/^www\./, '');
    const finalHost = new URL(finalUrl).hostname.replace(/^www\./, '');
    return origHost === finalHost;
  } catch { return false; }
}

function isRootOnly(url) {
  try {
    const { pathname, search } = new URL(url);
    return (pathname === '/' || pathname === '') && !search;
  } catch { return false; }
}

// Per-domain rate limiter (shared across concurrent requests)
const domainLastRequest = new Map();
async function withDomainRateLimit(url, fn) {
  const domain = getDomain(url);
  const last = domainLastRequest.get(domain) ?? 0;
  const wait = DOMAIN_DELAY_MS - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  domainLastRequest.set(domain, Date.now());
  return fn();
}

// ── Phase 1: Export ───────────────────────────────────────────────────────────
async function exportUrls() {
  if (existsSync(EXPORT_FILE) && !RE_EXPORT && !RESET) {
    const lineCount = readFileSync(EXPORT_FILE, 'utf-8').split('\n').filter(Boolean).length;
    console.log(`[export] Using cached export (${lineCount.toLocaleString()} URLs). Pass --re-export to refresh.\n`);
    return;
  }

  console.log('[export] Downloading active URL list from Supabase...');
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  const stream = createWriteStream(EXPORT_FILE);
  let total = 0;
  let page = 0;

  while (true) {
    let query = supabase
      .from('urls')
      .select('id, url, source')
      .eq('approved', true)
      .eq('inactive', false)
      .order('id')
      .range(page * EXPORT_PAGE_SIZE, (page + 1) * EXPORT_PAGE_SIZE - 1);

    if (SOURCE_ARG) query = query.eq('source', SOURCE_ARG);

    const { data, error } = await query;
    if (error) {
      console.error('[export] Query error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const row of data) stream.write(JSON.stringify(row) + '\n');
    total += data.length;
    page++;
    process.stdout.write(`\r[export] ${total.toLocaleString()} URLs...`);
    if (data.length < EXPORT_PAGE_SIZE) break;
  }

  await new Promise((resolve) => stream.end(resolve));
  console.log(`\n[export] Done: ${total.toLocaleString()} URLs → ${EXPORT_FILE}\n`);
}

// ── Phase 2: Check ────────────────────────────────────────────────────────────

/**
 * HEAD-check a single URL, following redirects manually.
 * @returns {{ urlId, status, dead, redirect, newUrl?, reason? }}
 */
async function checkUrl(urlId, url) {
  let currentUrl = url;
  let hops = 0;
  let lastStatus = 0;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        response = await withDomainRateLimit(currentUrl, () =>
          fetch(currentUrl, {
            method: 'HEAD',
            redirect: 'manual',
            signal: controller.signal,
            headers: {
              'User-Agent': 'Roam-LinkChecker/1.0 (+https://roamtheweb.app/about)',
            },
          })
        );
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        if (attempt < MAX_RETRIES - 1) { await sleep(1_000); continue; }
        return { urlId, status: 0, dead: true, reason: 'timeout' };
      }
      const msg = err.message ?? '';
      if (/certificate|SSL|CERT/i.test(msg)) {
        return { urlId, status: 0, dead: true, reason: 'ssl-error' };
      }
      if (/ENOTFOUND|ECONNREFUSED|ECONNRESET/i.test(msg)) {
        if (attempt < MAX_RETRIES - 1) { await sleep(1_000); continue; }
        return { urlId, status: 0, dead: true, reason: 'dns-or-connection-failure' };
      }
      if (attempt < MAX_RETRIES - 1) { await sleep(1_000); continue; }
      return { urlId, status: 0, dead: true, reason: `network: ${msg.slice(0, 80)}` };
    }

    lastStatus = response.status;

    // ── Redirect handling ──────────────────────────────────────────────────
    if (response.status >= 300 && response.status < 400) {
      if (hops >= MAX_REDIRECTS) {
        return { urlId, status: response.status, dead: true, reason: 'redirect-loop' };
      }
      const location = response.headers.get('location');
      if (!location) {
        return { urlId, status: response.status, dead: true, reason: 'redirect-no-location' };
      }
      try {
        currentUrl = new URL(location, currentUrl).toString();
      } catch {
        return { urlId, status: response.status, dead: true, reason: 'redirect-bad-location' };
      }
      hops++;
      attempt = -1; // reset retry counter for the new URL
      continue;
    }

    // ── Success ────────────────────────────────────────────────────────────
    if (response.status >= 200 && response.status < 300) {
      if (hops === 0) {
        return { urlId, status: response.status, dead: false, redirect: false };
      }
      // We were redirected — decide what to do
      const originalNorm = normaliseUrl(url);
      const finalNorm    = normaliseUrl(currentUrl);
      if (finalNorm === originalNorm) {
        return { urlId, status: response.status, dead: false, redirect: false };
      }
      if (isSameDomainRedirect(url, currentUrl) && !isRootOnly(currentUrl)) {
        // Path change on same domain — update the stored URL
        return { urlId, status: response.status, dead: false, redirect: true, newUrl: finalNorm };
      }
      // Domain change or redirected to homepage — treat as retired content
      return { urlId, status: response.status, dead: true, redirect: true, reason: 'redirect-domain-change' };
    }

    // ── Client errors ──────────────────────────────────────────────────────
    if (response.status === 403 || response.status === 405) {
      // Blocked HEAD — site is alive, just won't serve HEAD requests
      return { urlId, status: response.status, dead: false, redirect: false };
    }
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') ?? '30', 10);
      await sleep(Math.min(retryAfter * 1_000, 30_000));
      continue;
    }
    if (response.status === 404 || response.status === 410 || response.status === 451) {
      return { urlId, status: response.status, dead: true, reason: `http-${response.status}` };
    }
    if (response.status >= 400 && response.status < 500) {
      return { urlId, status: response.status, dead: true, reason: `http-${response.status}` };
    }

    // ── Server errors — retry ──────────────────────────────────────────────
    if (response.status >= 500) {
      if (attempt < MAX_RETRIES - 1) { await sleep(2_000 * (attempt + 1)); continue; }
      return { urlId, status: response.status, dead: true, reason: `http-${response.status}` };
    }
  }

  return { urlId, status: lastStatus, dead: true, reason: 'max-retries' };
}

async function runChecks() {
  if (RESET) {
    if (existsSync(RESULTS_FILE))  unlinkSync(RESULTS_FILE);
    if (existsSync(PROGRESS_FILE)) unlinkSync(PROGRESS_FILE);
    console.log('[check] Reset: cleared previous results.\n');
  }

  // Load all rows from export
  const exportLines = readFileSync(EXPORT_FILE, 'utf-8').split('\n').filter(Boolean);
  const allRows = exportLines
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);

  // Load checkpoint
  let progress = { checkedCount: 0 };
  if (existsSync(PROGRESS_FILE) && !RESET) {
    try { progress = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8')); } catch {}
  }

  const startIdx = progress.checkedCount;
  let rows = allRows.slice(startIdx);
  if (LIMIT_ARG) rows = rows.slice(0, LIMIT_ARG);

  const totalToCheck = rows.length;
  if (totalToCheck === 0) {
    console.log('[check] Nothing left to check (all rows already processed).\n');
    return;
  }

  console.log(`[check] ${allRows.length.toLocaleString()} total URLs in export.`);
  if (startIdx > 0) console.log(`[check] Resuming from index ${startIdx.toLocaleString()}.`);
  console.log(`[check] Checking ${totalToCheck.toLocaleString()} URLs  (concurrency=${CONCURRENCY}, timeout=${TIMEOUT_MS}ms)`);
  console.log(COMMIT
    ? '[check] --commit: dead/redirect corrections WILL be written to Supabase\n'
    : '[check] --dry-run: no DB writes  (pass --commit to apply)\n');

  // Ensure results file exists
  if (!existsSync(RESULTS_FILE)) writeFileSync(RESULTS_FILE, '');

  let done = 0;
  let deadCount = 0;
  let redirectCount = 0;

  // Process rows in chunks of CONCURRENCY
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map((row) => checkUrl(row.id, row.url)));

    for (const result of results) {
      appendFileSync(RESULTS_FILE, JSON.stringify(result) + '\n');
      if (result.dead) deadCount++;
      if (result.redirect && !result.dead) redirectCount++;
    }

    done += chunk.length;
    progress.checkedCount = startIdx + done;
    writeFileSync(PROGRESS_FILE, JSON.stringify(progress));

    if (done % 500 === 0 || done === totalToCheck) {
      process.stdout.write(
        `\r[check] ${done.toLocaleString()}/${totalToCheck.toLocaleString()}` +
        `  dead=${deadCount.toLocaleString()}  redirects=${redirectCount.toLocaleString()}  `
      );
    }
  }

  console.log(`\n\n[check] Complete:  ${deadCount.toLocaleString()} dead,  ${redirectCount.toLocaleString()} redirects.\n`);
}

// ── Phase 3: Commit ────────────────────────────────────────────────────────────
async function commitResults() {
  const lines = readFileSync(RESULTS_FILE, 'utf-8').split('\n').filter(Boolean);
  const results = lines
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);

  const deadIds     = results.filter((r) => r.dead).map((r) => r.urlId);
  const redirectFixes = results.filter((r) => !r.dead && r.redirect && r.newUrl);

  console.log(`[commit] Dead URLs: ${deadIds.length.toLocaleString()}`);
  console.log(`[commit] Redirect path updates: ${redirectFixes.length.toLocaleString()}`);

  if (!COMMIT) {
    console.log('\n[commit] Dry-run complete.  Results file:', RESULTS_FILE);
    console.log('[commit] Re-run with --commit to apply changes to Supabase.\n');
    return;
  }

  // Mark dead URLs as inactive
  if (deadIds.length > 0) {
    console.log('\n[commit] Writing inactive=TRUE for dead URLs...');
    let retired = 0;
    for (let i = 0; i < deadIds.length; i += DB_BATCH_SIZE) {
      const batch = deadIds.slice(i, i + DB_BATCH_SIZE);
      const { error } = await supabase
        .from('urls')
        .update({ inactive: true })
        .in('id', batch);
      if (error) {
        console.error(`[commit] Update error (batch ${Math.floor(i / DB_BATCH_SIZE) + 1}):`, error.message);
      } else {
        retired += batch.length;
        process.stdout.write(`\r[commit] Retired ${retired.toLocaleString()}/${deadIds.length.toLocaleString()}  `);
      }
    }
    console.log(`\n[commit] Retired ${retired.toLocaleString()} dead URLs.\n`);
  }

  // Apply same-domain redirect corrections
  if (redirectFixes.length > 0) {
    console.log('[commit] Applying redirect path corrections...');
    let updated = 0;
    for (const r of redirectFixes) {
      const { error } = await supabase
        .from('urls')
        .update({ url: r.newUrl, original_url: r.newUrl })
        .eq('id', r.urlId);
      if (!error) updated++;
    }
    console.log(`[commit] Updated ${updated.toLocaleString()} redirect paths.\n`);
  }

  console.log('[commit] Done.\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[error] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
  }

  const divider = '─'.repeat(58);
  console.log(divider);
  console.log('  Roam Dead-Link Checker');
  if (SOURCE_ARG) console.log(`  Source filter: ${SOURCE_ARG}`);
  if (LIMIT_ARG)  console.log(`  Limit: ${LIMIT_ARG.toLocaleString()} URLs`);
  console.log(divider + '\n');

  await exportUrls();
  await runChecks();
  await commitResults();
}

main().catch((err) => { console.error(err); process.exit(1); });
