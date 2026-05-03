/**
 * seed.js — shared seeding utility
 *
 * Usage (from any seeder script):
 *
 *   import { upsertUrls } from './lib/seed.js';
 *
 *   await upsertUrls([
 *     {
 *       url:          'https://example.com/article',
 *       title:        'Article title',
 *       description:  'Short description',
 *       category_id:  'c10000000000000000000000000000001',
 *       subcategory_id: null,   // optional
 *       source:       'wikipedia',
 *     },
 *     ...
 *   ]);
 *
 * The utility will:
 *   1. Normalise each URL (https, strip www, strip tracking params, etc.)
 *   2. Skip duplicates already in the database
 *   3. Fetch the og:image for any row that doesn't have one
 *   4. Batch-upsert into the `urls` table with approved = true
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';

// Load .env from the repo root (two levels up from scripts/lib/)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// ── Supabase client (service role — bypasses RLS) ────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── fetchWithRetry — unified fetch with exponential back-off ─────────────────
/**
 * Drop-in replacement for `fetch()` that retries on network errors and 429s.
 *
 * @param {string} url
 * @param {object} options   — passed straight through to fetch()
 * @param {{ retries?: number, base?: number }} retryOpts
 *   retries  max number of retry attempts (default 3)
 *   base     base delay in ms for exponential backoff (default 2000)
 *
 * Respects the `Retry-After` response header on 429.
 * Re-throws on the final attempt. All other non-2xx responses are returned
 * as-is so the caller can inspect the status code.
 */
export async function fetchWithRetry(url, options = {}, { retries = 3, base = 2000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') ?? '0', 10);
        const wait = retryAfter > 0 ? retryAfter * 1000 : base * 2 ** attempt;
        if (attempt < retries) { await sleep(wait); continue; }
      }
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(base * 2 ** attempt);
    }
  }
}

// ── createThrottle — AutoThrottle-style adaptive rate limiter ─────────────────
/**
 * Returns a throttle function that adapts the inter-request delay based on
 * actual server response latency, similar to Scrapy's AutoThrottle extension.
 *
 * @param {{ target?: number, min?: number, max?: number }} opts
 *   target  target server latency in ms to aim for (default 500)
 *   min     minimum delay in ms (default 100)
 *   max     maximum delay in ms (default 15000)
 *
 * Usage:
 *   const throttle = createThrottle();
 *   const t0 = Date.now();
 *   const res = await fetchWithRetry(url);
 *   await throttle(Date.now() - t0);   // adapts delay and waits
 */
export function createThrottle({ target = 500, min = 100, max = 15_000 } = {}) {
  let delay = 1000;
  return async function throttle(responseMs) {
    // Proportional adjustment: if server was slow → back off, if fast → speed up
    delay = Math.min(max, Math.max(min, delay * (responseMs / target)));
    await sleep(delay);
  };
}

// ── Tracking / noise query params to strip ───────────────────────────────────
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_reader', 'utm_name', 'utm_brand',
  'fbclid', 'gclid', 'msclkid', 'dclid', 'zanpid', 'igshid',
  'mc_cid', 'mc_eid', 'ref', 'referrer', '_ga', 'twclid',
  'yclid', 's_cid', 'ncid', 'nr_email_referer',
]);

// ── URL normalisation ─────────────────────────────────────────────────────────
// NOTE: The canonical URL normalisation logic is in
// supabase/functions/_shared/normalise.ts (Deno/TypeScript).
// This Node.js version is semantically equivalent but uses Node-compatible APIs.
// If you add new tracking params or change the normalisation logic, update BOTH.
export function normaliseUrl(raw) {
  let u;
  try {
    // Ensure a scheme is present before parsing
    u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null; // unparseable — skip
  }

  // Enforce HTTPS
  u.protocol = 'https:';

  // Strip www.
  u.hostname = u.hostname.replace(/^www\./, '');

  // Lowercase hostname
  u.hostname = u.hostname.toLowerCase();

  // Remove fragment
  u.hash = '';

  // Strip tracking query params
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key)) u.searchParams.delete(key);
  }

  // Remove trailing slash from pathname (unless it's just "/")
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.slice(0, -1);
  }

  return u.toString();
}

// ── Fetch og:image from a page ────────────────────────────────────────────────
const OG_TIMEOUT_MS = 8000;

export async function fetchOgImage(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OG_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
      redirect: 'follow',
    });

    if (!res.ok) { clearTimeout(timer); return null; }
    const contentLen = parseInt(res.headers.get('content-length') || '0');
    if (contentLen > 2_000_000) { clearTimeout(timer); return null; }
    const html = await res.text();
    clearTimeout(timer);

    // og:image
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch) return ogMatch[1].trim();

    // twitter:image fallback
    const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twMatch) return twMatch[1].trim();

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch og:image AND og:description from a page.
 * Returns { image: string|null, description: string|null }
 */
export async function fetchOgMeta(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OG_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
      redirect: 'follow',
    });

    if (!res.ok) { clearTimeout(timer); return { image: null, description: null }; }
    const contentLen = parseInt(res.headers.get('content-length') || '0');
    if (contentLen > 2_000_000) { clearTimeout(timer); return { image: null, description: null }; }
    const html = await res.text();
    clearTimeout(timer);

    // og:image
    const ogImgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const twImgMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    const image = ogImgMatch?.[1]?.trim() ?? twImgMatch?.[1]?.trim() ?? null;

    // og:description
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const rawDesc = ogDescMatch?.[1]?.trim() ?? metaDescMatch?.[1]?.trim() ?? null;
    const description = rawDesc ? rawDesc.slice(0, 500) : null;

    // language — from <html lang="..."> attribute; normalise BCP-47 to base code
    const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
    const rawLang = langMatch?.[1]?.trim().toLowerCase() ?? null;
    // 'en-US' → 'en', 'zh-Hant' → 'zh', etc.
    const language = rawLang ? rawLang.split(/[-_]/)[0] : null;

    return { image, description, language };
  } catch {
    return { image: null, description: null, language: null };
  }
}

// ── Main export: upsert a batch of URL records ────────────────────────────────
const BATCH_SIZE = 50;

// Known CATEGORY UUIDs for validation
const VALID_CATEGORY_IDS = new Set([
  'c1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000004',
  'c1000000-0000-0000-0000-000000000005',
  'c1000000-0000-0000-0000-000000000006',
  'c1000000-0000-0000-0000-000000000007',
  'c1000000-0000-0000-0000-000000000008',
]);

/**
 * @param {Array<{
 *   url: string,
 *   title?: string,
 *   description?: string,
 *   category_id?: string,
 *   subcategory_id?: string,
 *   source?: string,
 *   og_image_url?: string,
 *   language?: string,
 * }>} rows
 * @param {{
 *   fetchOg?: boolean,
 *   verbose?: boolean,
 *   checkLive?: boolean,
 *   requireTitle?: boolean,
 *   maxPerDomain?: number,
 * }} opts
 *
 * Options:
 *   fetchOg       — fetch og:image + description for rows missing them (default true)
 *   verbose       — log progress (default true)
 *   checkLive     — HEAD-check each URL before inserting; skip non-2xx (default false)
 *   requireTitle  — skip rows that still have no title after OG fetch (default true)
 *   maxPerDomain  — cap insertions per hostname; undefined = unlimited (default undefined)
 */
export async function upsertUrls(rows, {
  fetchOg       = true,
  verbose       = true,
  checkLive     = false,
  requireTitle  = true,
  maxPerDomain  = undefined,
} = {}) {
  const log = verbose ? console.log : () => {};

  // 1. Normalise URLs and drop anything unparseable
  const normalised = rows
    .map((r) => ({ ...r, url: normaliseUrl(r.url) }))
    .filter((r) => r.url !== null);

  if (normalised.length < rows.length) {
    log(`[seed] Dropped ${rows.length - normalised.length} unparseable URLs`);
  }

  // 1a. Validate category_id values (warn only — don't drop, some seeders pass null)
  const badCategory = normalised.filter(
    (r) => r.category_id && !VALID_CATEGORY_IDS.has(r.category_id),
  );
  if (badCategory.length > 0) {
    console.warn(`[seed] Warning: ${badCategory.length} rows have unrecognised category_id values`);
  }

  // 1b. Per-domain cap — applied before DB dedup to keep sampling deterministic
  let capped = normalised;
  if (maxPerDomain !== undefined) {
    const byDomain = new Map();
    for (const r of normalised) {
      let host;
      try { host = new URL(r.url).hostname; } catch { host = '__invalid__'; }
      if (!byDomain.has(host)) byDomain.set(host, []);
      byDomain.get(host).push(r);
    }
    capped = [];
    for (const [, group] of byDomain) {
      if (group.length <= maxPerDomain) {
        capped.push(...group);
      } else {
        // Deterministic shuffle via sort-by-hash so re-runs are stable
        const sampled = group
          .map((r) => ({ r, k: Math.random() }))
          .sort((a, b) => a.k - b.k)
          .slice(0, maxPerDomain)
          .map(({ r }) => r);
        capped.push(...sampled);
      }
    }
    if (capped.length < normalised.length) {
      log(`[seed] Per-domain cap (${maxPerDomain}): kept ${capped.length}/${normalised.length} rows`);
    }
  }

  // 2. Check which normalised URLs are already in the DB
  const urls = capped.map((r) => r.url);
  const { data: existing } = await supabase
    .from('urls')
    .select('url')
    .in('url', urls);

  const existingSet = new Set((existing ?? []).map((r) => r.url));
  let fresh = capped.filter((r) => !existingSet.has(r.url));

  log(`[seed] ${fresh.length} new / ${existingSet.size} already exist (${capped.length} total after cap)`);
  if (fresh.length === 0) return { inserted: 0, skipped: existingSet.size };

  // 3. Optional liveness check — HEAD request each URL, skip non-2xx
  if (checkLive) {
    log(`[seed] Liveness check for ${fresh.length} URLs...`);
    const LIVE_TIMEOUT_MS = 8000;
    const alive = [];
    let dead = 0;
    for (let i = 0; i < fresh.length; i++) {
      const row = fresh[i];
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
        const res = await fetch(row.url, {
          method:  'HEAD',
          signal:  controller.signal,
          headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
          redirect: 'follow',
        });
        clearTimeout(timer);
        // 403/405 = alive but blocked — keep. Treat all others < 400 as alive.
        if (res.status < 400 || res.status === 403 || res.status === 405) {
          alive.push(row);
        } else {
          dead++;
        }
      } catch {
        dead++;
      }
      if (verbose && (i + 1) % 50 === 0) {
        log(`[seed]   liveness ${i + 1}/${fresh.length}  dead=${dead}`);
      }
    }
    log(`[seed] Liveness: ${alive.length} alive, ${dead} dead/unreachable — skipping dead`);
    fresh = alive;
    if (fresh.length === 0) return { inserted: 0, skipped: existingSet.size };
  }

  // 4. Fetch og:image + og:description for rows that don't have them
  if (fetchOg) {
    log(`[seed] Fetching OG metadata for ${fresh.length} URLs...`);
    for (let i = 0; i < fresh.length; i++) {
      const row = fresh[i];
      if (!row.og_image_url || !row.description) {
        const meta = await fetchOgMeta(row.url);
        if (!row.og_image_url) row.og_image_url = meta.image;
        if (!row.description)  row.description  = meta.description;
        // Use language detected from <html lang=""> if not already set
        if (!row.language && meta.language) row.language = meta.language;
      }
      if (verbose && (i + 1) % 10 === 0) {
        log(`[seed]   ${i + 1}/${fresh.length} done`);
      }
    }
  }

  // 5. Minimum metadata quality gate — skip rows with no title
  if (requireTitle) {
    const before = fresh.length;
    fresh = fresh.filter((r) => r.title && r.title.trim().length > 0);
    const skippedNoTitle = before - fresh.length;
    if (skippedNoTitle > 0) {
      log(`[seed] Skipped ${skippedNoTitle} rows: missing title`);
    }
    if (fresh.length === 0) return { inserted: 0, skipped: existingSet.size };
  }

  // 6. Batch upsert
  let inserted = 0;
  for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
    const batch = fresh.slice(i, i + BATCH_SIZE).map((r) => ({
      url:            r.url,
      original_url:   r.url,
      title:          r.title        ?? null,
      description:    r.description  ?? null,
      og_image_url:   r.og_image_url ?? null,
      category_id:    r.category_id  ?? null,
      subcategory_id: r.subcategory_id ?? null,
      source:         r.source       ?? 'manual',
      language:       r.language     ?? 'en',
      approved:       true,
      wilson_score:   0,
      upvotes:        0,
      downvotes:      0,
    }));

    const { error, count } = await supabase
      .from('urls')
      .upsert(batch, { onConflict: 'url', ignoreDuplicates: true })
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error(`[seed] Upsert error on batch ${i / BATCH_SIZE + 1}:`, error.message);
    } else {
      inserted += count ?? batch.length;
      log(`[seed] Batch ${Math.floor(i / BATCH_SIZE) + 1}: upserted ${batch.length} rows`);
    }
  }

  log(`[seed] Done. Inserted: ${inserted}, Skipped: ${existingSet.size}`);
  return { inserted, skipped: existingSet.size };
}

// ── Category / subcategory ID helpers ────────────────────────────────────────
// Fixed UUIDs matching the migration seed data
export const CATEGORY = {
  SCIENCE:         'c1000000-0000-0000-0000-000000000001',
  TECHNOLOGY:      'c1000000-0000-0000-0000-000000000002',
  ARTS_CULTURE:    'c1000000-0000-0000-0000-000000000003',
  HISTORY_IDEAS:   'c1000000-0000-0000-0000-000000000004',
  GAMES_HOBBIES:   'c1000000-0000-0000-0000-000000000005',
  WEIRD_WONDERFUL: 'c1000000-0000-0000-0000-000000000006',
  PEOPLE_PLACES:   'c1000000-0000-0000-0000-000000000007',
  MIND_BODY:       'c1000000-0000-0000-0000-000000000008',
};

/** Fetch subcategory IDs from DB by name (case-insensitive prefix match). */
export async function getSubcategoryId(name) {
  const { data } = await supabase
    .from('subcategories')
    .select('id')
    .ilike('name', `%${name}%`)
    .limit(1)
    .single();
  return data?.id ?? null;
}
