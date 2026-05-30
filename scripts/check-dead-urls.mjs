/**
 * check-dead-urls.mjs — Batch dead-link, redirect, and language checker
 *
 * Workflow (4 phases):
 *   Phase 1 – Export   SELECT id, url, source, language FROM urls WHERE approved=TRUE AND inactive=FALSE
 *                       Streams to .cache/dead-links-export.jsonl  (skipped if cache exists)
 *   Phase 2 – Check    HEAD each URL; follow redirects manually; classify alive/dead/redirect
 *                       Appends to .cache/dead-links-results.jsonl  (resumable via checkpoint)
 *   Phase 3 – Language GET first 16KB of each alive URL; parse <html lang="...">; detect language
 *                       Appends to .cache/language-results.jsonl  (resumable via checkpoint)
 *                       Skipped when --skip-language is passed.
 *   Phase 4 – Commit   Batch UPDATE inactive=TRUE for dead URLs; UPDATE url for content-move
 *                       redirects (same- or cross-domain); UPDATE language where changed.
 *                       Only runs when --commit is passed.
 *
 * Usage:
 *   node scripts/check-dead-urls.mjs [options]
 *
 * Options:
 *   --dry-run          (default) Export + check + language detect; no DB writes
 *   --commit           Write results to Supabase
 *   --source <name>    Scope export to one source (e.g. --source reddit)
 *   --limit <n>        Check only first N URLs from export (testing)
 *   --concurrency <n>  Parallel request slots (default: 20)
 *   --re-export        Re-download URL list even if cache exists
 *   --reset            Delete checkpoint and result files; re-run phases 2-3 from scratch
 *   --strict-403       Treat HTTP 403 as dead (default: alive — many sites block HEAD scraping)
 *   --fix-redirects    Update DB url for content-move redirects (same- or cross-domain non-root)
 *   --skip-language    Skip Phase 3 language detection entirely
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
const EXPORT_FILE            = resolve(CACHE_DIR, 'dead-links-export.jsonl');
const RESULTS_FILE           = resolve(CACHE_DIR, 'dead-links-results.jsonl');
const PROGRESS_FILE          = resolve(CACHE_DIR, 'dead-links-progress.json');
const LANGUAGE_RESULTS_FILE  = resolve(CACHE_DIR, 'language-results.jsonl');
const LANGUAGE_PROGRESS_FILE = resolve(CACHE_DIR, 'language-progress.json');
const COMMIT_PROGRESS_FILE   = resolve(CACHE_DIR, 'dead-links-commit-progress.json');

dotenvConfig({ path: resolve(__dirname, '../.env') });

// ── CLI flags ────────────────────────────────────────────────────────────────
const COMMIT_ONLY   = process.argv.includes('--commit-only'); // skip phases 1-3, go straight to commit
const COMMIT        = process.argv.includes('--commit') || COMMIT_ONLY;
const RE_EXPORT     = process.argv.includes('--re-export');
const RESET         = process.argv.includes('--reset');
const STRICT_403    = process.argv.includes('--strict-403');
const FIX_REDIRECTS = process.argv.includes('--fix-redirects');
const SKIP_LANGUAGE = process.argv.includes('--skip-language');

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

// ── ETA formatter ───────────────────────────────────────────────────────────
function fmtEta(doneCount, totalCount, startMs) {
  if (doneCount === 0) return '?';
  const elapsed = Date.now() - startMs;
  const rate = doneCount / elapsed;           // URLs per ms
  const remaining = (totalCount - doneCount) / rate;
  const s = Math.round(remaining / 1000);
  if (s < 60)  return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
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
  let lastId = '00000000-0000-0000-0000-000000000000';  // keyset cursor
  const MAX_PAGE_RETRIES = 5;
  const exportStart = Date.now();

  while (true) {
    let data = null;
    let lastError = null;

    for (let attempt = 0; attempt < MAX_PAGE_RETRIES; attempt++) {
      let query = supabase
        .from('urls')
        .select('id, url, source, language')
        .eq('approved', true)
        .eq('inactive', false)
        .gt('id', lastId)            // keyset pagination — avoids OFFSET scan
        .order('id')
        .limit(EXPORT_PAGE_SIZE);

      if (SOURCE_ARG) query = query.eq('source', SOURCE_ARG);

      const result = await query;
      if (!result.error) {
        data = result.data;
        lastError = null;
        break;
      }
      lastError = result.error;
      if (attempt < MAX_PAGE_RETRIES - 1) {
        process.stdout.write(`\r[export] timeout on page after ${total.toLocaleString()}, retrying (${attempt + 1})...`);
        await sleep(2000 * (attempt + 1));
      }
    }

    if (lastError) {
      console.error(`\n[export] Failed after ${MAX_PAGE_RETRIES} retries: ${lastError.message}`);
      break;
    }
    if (!data || data.length === 0) break;

    for (const row of data) stream.write(JSON.stringify(row) + '\n');
    total += data.length;
    lastId = data[data.length - 1].id;
    const elapsedS = ((Date.now() - exportStart) / 1000).toFixed(1);
    const rate = (total / ((Date.now() - exportStart) / 1000)).toFixed(0);
    process.stdout.write(`\r[export] ${total.toLocaleString()} URLs  (${rate}/s, ${elapsedS}s elapsed)...`);
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
      // Cross-domain redirect — content move if destination is real content, retired if root-only
      if (isRootOnly(currentUrl)) {
        return { urlId, status: response.status, dead: true, redirect: true, reason: 'redirect-to-homepage' };
      }
      return { urlId, status: response.status, dead: false, redirect: true, newUrl: finalNorm };
    }

    // ── Client errors ──────────────────────────────────────────────────────
    if (response.status === 403 || response.status === 405) {
      // 405: HEAD not allowed — server is alive
      // 403: site blocks scrapers — treat as alive unless --strict-403 is set
      if (response.status === 403 && STRICT_403) {
        return { urlId, status: response.status, dead: true, reason: 'http-403' };
      }
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
    if (existsSync(RESULTS_FILE))           unlinkSync(RESULTS_FILE);
    if (existsSync(PROGRESS_FILE))          unlinkSync(PROGRESS_FILE);
    if (existsSync(LANGUAGE_RESULTS_FILE))  unlinkSync(LANGUAGE_RESULTS_FILE);
    if (existsSync(LANGUAGE_PROGRESS_FILE)) unlinkSync(LANGUAGE_PROGRESS_FILE);
    if (existsSync(COMMIT_PROGRESS_FILE))   unlinkSync(COMMIT_PROGRESS_FILE);
    console.log('[check] Reset: cleared previous results (phases 2–3).\n');
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
  const checkStart = Date.now();

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

    const pct = Math.floor(done / totalToCheck * 100);
    process.stdout.write(
      `\r[check] ${done.toLocaleString()}/${totalToCheck.toLocaleString()} (${pct}%)` +
      `  dead=${deadCount.toLocaleString()}  redirects=${redirectCount.toLocaleString()}` +
      `  eta=${fmtEta(done, totalToCheck, checkStart)}  `
    );
  }

  console.log(`\n\n[check] Complete:  ${deadCount.toLocaleString()} dead,  ${redirectCount.toLocaleString()} redirects.\n`);
}

// ── Phase 3: Language Detection ───────────────────────────────────────────────

/**
 * Fetch the first 16KB of a URL and extract the BCP-47 base language tag
 * from the <html lang="..."> attribute.  Returns null if not found or on error.
 */
async function detectLanguage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    let response;
    try {
      response = await withDomainRateLimit(url, () =>
        fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Roam-LinkChecker/1.0 (+https://roamtheweb.app/about)',
            'Range': 'bytes=0-16383',
            'Accept': 'text/html',
          },
        })
      );
    } catch {
      return null;
    }

    if (response.status !== 200 && response.status !== 206) return null;

    const MAX_BYTES = 16_384;
    const chunks = [];
    let received = 0;

    try {
      for await (const chunk of response.body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        received += chunk.length;
        if (received >= MAX_BYTES) break;
      }
    } catch {
      // stream interrupted (AbortController or partial read) — use what we have
    }

    if (chunks.length === 0) return null;

    const html = Buffer.concat(chunks).toString('utf-8', 0, MAX_BYTES);
    const match = html.match(/<html[^>]*\slang="([^"]+)"/i);
    if (!match) return null;

    const lang = match[1].split(/[-_]/)[0].toLowerCase();
    return lang || null;
  } finally {
    clearTimeout(timer);
  }
}

async function runLanguageCheck() {
  if (SKIP_LANGUAGE) {
    console.log('[language] Skipped (--skip-language).\n');
    return;
  }

  if (!existsSync(EXPORT_FILE) || !existsSync(RESULTS_FILE)) {
    console.log('[language] Skipping — export or check results not found.\n');
    return;
  }

  // Build id → { url, language } map from Phase 1 export
  const exportLines = readFileSync(EXPORT_FILE, 'utf-8').split('\n').filter(Boolean);
  const urlMap = new Map();
  for (const line of exportLines) {
    try {
      const row = JSON.parse(line);
      urlMap.set(row.id, { url: row.url, language: row.language ?? 'en' });
    } catch {}
  }

  // Collect alive URLs from Phase 2 results
  const resultLines = readFileSync(RESULTS_FILE, 'utf-8').split('\n').filter(Boolean);
  const aliveRows = resultLines
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((r) => r && !r.dead)
    .map((r) => {
      const meta = urlMap.get(r.urlId);
      return meta ? { urlId: r.urlId, url: meta.url, language: meta.language } : null;
    })
    .filter(Boolean);

  // Load checkpoint
  let progress = { checkedCount: 0 };
  if (existsSync(LANGUAGE_PROGRESS_FILE) && !RESET) {
    try { progress = JSON.parse(readFileSync(LANGUAGE_PROGRESS_FILE, 'utf-8')); } catch {}
  }

  const startIdx = progress.checkedCount;
  const rows = aliveRows.slice(startIdx);

  if (rows.length === 0) {
    console.log('[language] Nothing left to check (all alive URLs already processed).\n');
    return;
  }

  console.log(`[language] ${aliveRows.length.toLocaleString()} alive URLs to language-check.`);
  if (startIdx > 0) console.log(`[language] Resuming from index ${startIdx.toLocaleString()}.`);
  console.log(`[language] Detecting via partial GET  (concurrency=${CONCURRENCY}, timeout=6s)\n`);

  if (!existsSync(LANGUAGE_RESULTS_FILE)) writeFileSync(LANGUAGE_RESULTS_FILE, '');

  let done = 0;
  let detectedCount = 0;
  let changedCount = 0;
  const langStart = Date.now();

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const langResults = await Promise.all(chunk.map(async (row) => {
      const detectedLanguage = await detectLanguage(row.url);
      return { urlId: row.urlId, currentLanguage: row.language, detectedLanguage };
    }));

    for (const result of langResults) {
      appendFileSync(LANGUAGE_RESULTS_FILE, JSON.stringify(result) + '\n');
      if (result.detectedLanguage !== null) detectedCount++;
      if (result.detectedLanguage !== null && result.detectedLanguage !== result.currentLanguage) changedCount++;
    }

    done += chunk.length;
    progress.checkedCount = startIdx + done;
    writeFileSync(LANGUAGE_PROGRESS_FILE, JSON.stringify(progress));

    const pct = Math.floor(done / rows.length * 100);
    process.stdout.write(
      `\r[language] ${done.toLocaleString()}/${rows.length.toLocaleString()} (${pct}%)` +
      `  detected=${detectedCount.toLocaleString()}  to-update=${changedCount.toLocaleString()}` +
      `  eta=${fmtEta(done, rows.length, langStart)}  `
    );
  }

  console.log(`\n\n[language] Complete:  ${detectedCount.toLocaleString()} lang attrs found,  ${changedCount.toLocaleString()} changes to apply.\n`);
}

// ── Phase 4: Commit ────────────────────────────────────────────────────────────
async function commitResults() {
  // Load commit progress so we only process lines not yet committed
  let commitProgress = { resultsOffset: 0, langOffset: 0 };
  if (existsSync(COMMIT_PROGRESS_FILE)) {
    try { commitProgress = JSON.parse(readFileSync(COMMIT_PROGRESS_FILE, 'utf-8')); } catch {}
  }

  const allResultLines = readFileSync(RESULTS_FILE, 'utf-8').split('\n').filter(Boolean);
  const newResultLines = allResultLines.slice(commitProgress.resultsOffset);
  const results = newResultLines
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);

  const deadIds = results.filter((r) => r.dead).map((r) => r.urlId);
  const redirectFixes = FIX_REDIRECTS
    ? results.filter((r) => !r.dead && r.redirect && r.newUrl)
    : [];

  // Load language results if available
  let langUpdates = [];
  let allLangLines = [];
  if (!SKIP_LANGUAGE && existsSync(LANGUAGE_RESULTS_FILE)) {
    allLangLines = readFileSync(LANGUAGE_RESULTS_FILE, 'utf-8').split('\n').filter(Boolean);
    const newLangLines = allLangLines.slice(commitProgress.langOffset);
    langUpdates = newLangLines
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((r) => r && r.detectedLanguage !== null && r.detectedLanguage !== r.currentLanguage);
  }

  // ── Summary (always shown, even in dry-run) ───────────────────────────────
  const newResultsCount = newResultLines.length;
  const newLangCount = allLangLines.slice(commitProgress.langOffset).length;
  if (newResultsCount === 0 && newLangCount === 0) {
    console.log('[commit] Nothing new to commit (all results already committed).\n');
    return;
  }
  if (commitProgress.resultsOffset > 0 || commitProgress.langOffset > 0) {
    console.log(`[commit] Resuming from offset: results=${commitProgress.resultsOffset.toLocaleString()}, lang=${commitProgress.langOffset.toLocaleString()}`);
  }
  console.log(`[commit] Dead URLs to retire:    ${deadIds.length.toLocaleString()}`);
  if (FIX_REDIRECTS) {
    console.log(`[commit] Redirect URL updates:   ${redirectFixes.length.toLocaleString()}`);
  } else {
    const redirectCount = results.filter((r) => !r.dead && r.redirect && r.newUrl).length;
    if (redirectCount > 0) {
      console.log(`[commit] Content-move redirects: ${redirectCount.toLocaleString()} detected (pass --fix-redirects to update)`);
    }
  }
  if (!SKIP_LANGUAGE) {
    console.log(`[commit] Language corrections:   ${langUpdates.length.toLocaleString()}`);
  }

  if (!COMMIT) {
    console.log('\n[commit] Dry-run complete.  Pass --commit to apply changes to Supabase.\n');
    return;
  }

  // ── Mark dead URLs as inactive ────────────────────────────────────────────
  if (deadIds.length > 0) {
    console.log('\n[commit] Writing inactive=TRUE for dead URLs...');
    let retired = 0;
    const retireStart = Date.now();
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
        process.stdout.write(`\r[commit] Retired ${retired.toLocaleString()}/${deadIds.length.toLocaleString()}  eta=${fmtEta(retired, deadIds.length, retireStart)}  `);
      }
    }
    console.log(`\n[commit] Retired ${retired.toLocaleString()} dead URLs.\n`);
    commitProgress.resultsOffset = allResultLines.length;
    writeFileSync(COMMIT_PROGRESS_FILE, JSON.stringify(commitProgress));
  }

  // ── Apply redirect URL corrections ────────────────────────────────────────
  if (redirectFixes.length > 0) {
    console.log('[commit] Applying redirect URL corrections...');
    let updated = 0;
    let conflicted = 0;
    const redirectStart = Date.now();
    const REDIRECT_CONCURRENCY = 20;
    const conflictIds = [];

    // Process in parallel with a concurrency cap — each row gets a unique URL
    // so we can't batch with .in(); parallelism is the next best thing.
    for (let i = 0; i < redirectFixes.length; i += REDIRECT_CONCURRENCY) {
      const chunk = redirectFixes.slice(i, i + REDIRECT_CONCURRENCY);
      const results = await Promise.all(
        chunk.map((r) =>
          supabase
            .from('urls')
            .update({ url: r.newUrl, original_url: r.newUrl })
            .eq('id', r.urlId)
            .then(({ error }) => ({ r, error }))
        )
      );
      for (const { r, error } of results) {
        if (!error) {
          updated++;
        } else if (error.code === '23505') {
          conflictIds.push(r.urlId);
        }
      }
      process.stdout.write(`\r[commit] Redirects updated ${(updated + conflictIds.length).toLocaleString()}/${redirectFixes.length.toLocaleString()}  eta=${fmtEta(updated + conflictIds.length, redirectFixes.length, redirectStart)}  `);
    }

    // Batch-retire conflict IDs (new URL already exists in DB)
    if (conflictIds.length > 0) {
      for (let i = 0; i < conflictIds.length; i += DB_BATCH_SIZE) {
        const batch = conflictIds.slice(i, i + DB_BATCH_SIZE);
        await supabase.from('urls').update({ inactive: true }).in('id', batch);
        conflicted += batch.length;
      }
    }

    console.log(`\n[commit] Updated ${updated.toLocaleString()} redirect URLs,  ${conflicted.toLocaleString()} conflicts → marked inactive.\n`);
    commitProgress.resultsOffset = allResultLines.length;
    writeFileSync(COMMIT_PROGRESS_FILE, JSON.stringify(commitProgress));
  }

  // ── Apply language corrections ────────────────────────────────────────────
  if (langUpdates.length > 0) {
    console.log('[commit] Applying language corrections...');
    // Group by detected language for efficient batch updates
    const byLang = new Map();
    for (const r of langUpdates) {
      if (!byLang.has(r.detectedLanguage)) byLang.set(r.detectedLanguage, []);
      byLang.get(r.detectedLanguage).push(r.urlId);
    }
    let updated = 0;
    const langCommitStart = Date.now();
    for (const [lang, ids] of byLang) {
      for (let i = 0; i < ids.length; i += DB_BATCH_SIZE) {
        const batch = ids.slice(i, i + DB_BATCH_SIZE);
        const { error } = await supabase
          .from('urls')
          .update({ language: lang })
          .in('id', batch);
        if (!error) {
          updated += batch.length;
          process.stdout.write(`\r[commit] Language updated ${updated.toLocaleString()}/${langUpdates.length.toLocaleString()}  eta=${fmtEta(updated, langUpdates.length, langCommitStart)}  `);
        }
      }
    }
    console.log(`\n[commit] Updated ${updated.toLocaleString()} language tags.\n`);
    commitProgress.langOffset = allLangLines.length;
    writeFileSync(COMMIT_PROGRESS_FILE, JSON.stringify(commitProgress));
  }

  // Advance results offset even when there were no dead/redirect rows to write
  // (e.g. all new results were alive-only). This prevents re-scanning them next run.
  if (newResultLines.length > 0 && commitProgress.resultsOffset < allResultLines.length) {
    commitProgress.resultsOffset = allResultLines.length;
    writeFileSync(COMMIT_PROGRESS_FILE, JSON.stringify(commitProgress));
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
  console.log('  Roam Dead-Link & Language Checker');
  if (SOURCE_ARG)    console.log(`  Source filter:  ${SOURCE_ARG}`);
  if (LIMIT_ARG)     console.log(`  Limit:          ${LIMIT_ARG.toLocaleString()} URLs`);
  if (STRICT_403)    console.log('  --strict-403:   403 treated as dead');
  if (FIX_REDIRECTS) console.log('  --fix-redirects: content-move redirects will be updated in DB');
  if (SKIP_LANGUAGE) console.log('  --skip-language: language detection skipped');

  // Show resume state for each phase
  const resumeLines = [];
  if (existsSync(EXPORT_FILE)) {
    const exportCount = readFileSync(EXPORT_FILE, 'utf-8').split('\n').filter(Boolean).length;
    resumeLines.push(`  Phase 1 export:    ${exportCount.toLocaleString()} URLs cached`);
  }
  if (existsSync(PROGRESS_FILE)) {
    try {
      const p = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
      resumeLines.push(`  Phase 2 checked:   ${p.checkedCount.toLocaleString()} done`);
    } catch {}
  }
  if (existsSync(LANGUAGE_PROGRESS_FILE)) {
    try {
      const p = JSON.parse(readFileSync(LANGUAGE_PROGRESS_FILE, 'utf-8'));
      resumeLines.push(`  Phase 3 language:  ${p.checkedCount.toLocaleString()} done`);
    } catch {}
  }
  if (resumeLines.length > 0) {
    console.log('  Resume state:');
    resumeLines.forEach((l) => console.log(l));
  }

  console.log(divider + '\n');

  if (COMMIT_ONLY) {
    await commitResults();
  } else {
    await exportUrls();
    await runChecks();
    await runLanguageCheck();
    await commitResults();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
