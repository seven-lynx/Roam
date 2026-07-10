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
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';

// Load .env from the repo root (two levels up from scripts/lib/)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

import { logSeedingRun } from '../log-seeding.mjs';

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

// ── Local-business / retail storefront filter ───────────────────────────────
// Hostnames that exclusively serve retail storefronts or local-business ordering
// pages — never editorial or interest-worthy content.
const LOCAL_BUSINESS_HOST_RE = [
  /\.myshopify\.com$/,   // Shopify storefronts
  /\.square\.site$/,     // Square hosted commerce sites
  /^toasttab\.com$/,     // Toast restaurant ordering
];

export function isLocalBusiness(url) {
  let host;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return false; }
  return LOCAL_BUSINESS_HOST_RE.some((re) => re.test(host));
}

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

    // canonical URL — use <link rel="canonical" href="..."> when present
    const canonicalMatch =
      html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ??
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
    const canonical = canonicalMatch?.[1]?.trim() ?? null;

    // ── JSON-LD structured data enrichment ─────────────────────────────────
    // Extract author, datePublished, headline from <script type="application/ld+json">
    let ldAuthor = null;
    let ldDatePublished = null;
    let ldHeadline = null;
    try {
      const ldJsonRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let ldMatch;
      while ((ldMatch = ldJsonRe.exec(html)) !== null) {
        try {
          const ld = JSON.parse(ldMatch[1]);

          // Handle @graph arrays
          const items = ld["@graph"] || [ld];
          for (const item of items) {
            if (!item) continue;
            // Author
            if (!ldAuthor) {
              if (typeof item.author === "string") ldAuthor = item.author;
              else if (Array.isArray(item.author) && item.author.length > 0) {
                ldAuthor = typeof item.author[0] === "string" ? item.author[0] : item.author[0]?.name;
              } else if (item.author?.name) ldAuthor = item.author.name;
            }
            // Date
            if (!ldDatePublished) {
              ldDatePublished = item.datePublished || item.dateCreated || item.dateModified;
            }
            // Headline (often better than <title>)
            if (!ldHeadline) {
              ldHeadline = item.headline || item.alternativeHeadline;
            }
            if (ldAuthor && ldDatePublished && ldHeadline) break;
          }
        } catch { /* malformed JSON-LD block — skip */ }
        if (ldAuthor && ldDatePublished && ldHeadline) break;
      }
    } catch { /* skip JSON-LD parsing on error */ }

    return { image, description, language, canonical, author: ldAuthor, datePublished: ldDatePublished, headline: ldHeadline };
  } catch {
    return { image: null, description: null, language: null, canonical: null };
  }
}

// ── Main export: upsert a batch of URL records ────────────────────────────────
const BATCH_SIZE = 500;

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
 *
 * Row fields accepted (in addition to url/title/description/etc.):
 *   published_at  — ISO 8601 string or Date (optional, null = unknown)
 *   seeder_score  — float 0.0–1.0 (optional, defaults to 0.0 in DB)
 */
export async function upsertUrls(rows, {
  fetchOg       = true,
  verbose       = true,
  checkLive     = true,
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

  // 1a. Drop local-business / retail storefront URLs
  const filtered = normalised.filter((r) => !isLocalBusiness(r.url));
  if (filtered.length < normalised.length) {
    log(`[seed] Dropped ${normalised.length - filtered.length} local-business / retail URLs`);
  }

  // 1b. Validate category_id values (warn only — don't drop, some seeders pass null)
  const badCategory = filtered.filter(
    (r) => r.category_id && !VALID_CATEGORY_IDS.has(r.category_id),
  );
  if (badCategory.length > 0) {
    console.warn(`[seed] Warning: ${badCategory.length} rows have unrecognised category_id values`);
  }

  // 1c. Per-domain cap — applied before DB dedup to keep sampling deterministic
  let capped = filtered;
  if (maxPerDomain !== undefined) {
    const byDomain = new Map();
    for (const r of filtered) {
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
    if (capped.length < filtered.length) {
      log(`[seed] Per-domain cap (${maxPerDomain}): kept ${capped.length}/${filtered.length} rows`);
    }
  }

  // 2. Check which normalised URLs are already in the DB
  // Batch the .in() query to avoid PostgREST query-size limits (hits at ~1k+ items)
  const urls = capped.map((r) => r.url);
  const EXIST_BATCH = 500;
  const existingAll = [];
  for (let i = 0; i < urls.length; i += EXIST_BATCH) {
    const chunk = urls.slice(i, i + EXIST_BATCH);
    const { data } = await supabase.from('urls').select('url').in('url', chunk);
    if (data) existingAll.push(...data);
  }

  const existingSet = new Set(existingAll.map((r) => r.url));
  let fresh = capped.filter((r) => !existingSet.has(r.url));

  log(`[seed] ${fresh.length} new / ${existingSet.size} already exist (${capped.length} total after cap)`);
  if (fresh.length === 0) return { inserted: 0, skipped: existingSet.size };

  // 3. Optional liveness check — HEAD request each URL, skip non-2xx
  let dead = 0;
  if (checkLive) {
    log(`[seed] Liveness check for ${fresh.length} URLs...`);
    const LIVE_TIMEOUT_MS = 8000;
    const alive = [];
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
    if (fresh.length === 0) return { inserted: 0, skipped: existingSet.size, dead };
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
        // 8.17: rewrite URL to canonical if the page declares one
        if (meta.canonical) {
          const normCanonical = normaliseUrl(meta.canonical);
          if (normCanonical && normCanonical !== row.url) {
            // Guard: skip if canonical is a root/homepage (path is "/" or "")
            // and it's on a different domain — indicates dead site redirecting to homepage.
            // Also skip if canonical hostname is a bare IP address (misconfigured tag).
            let skipRewrite = false;
            try {
              const origHost = new URL(row.url).hostname.replace(/^www\./, '');
              const canHost  = new URL(normCanonical).hostname.replace(/^www\./, '');
              const canPath  = new URL(normCanonical).pathname;
              const isIp     = /^\d{1,3}(\.\d{1,3}){3}$/.test(canHost);
              // No-dot hostname: "undefined", "null", "localhost", "blog", "api", etc.
              const noDot    = !canHost.includes('.');
              if (isIp || noDot) {
                skipRewrite = true;
              } else if (origHost !== canHost && (canPath === '/' || canPath === '')) {
                // Cross-domain rewrite to homepage → squatter/dead site redirect
                skipRewrite = true;
              } else if (origHost === canHost && (canPath === '/' || canPath === '')) {
                // Same-domain rewrite to homepage → article content replaced
                skipRewrite = true;
              }
            } catch { /* malformed URL — skip rewrite */ skipRewrite = true; }
            if (!skipRewrite) {
              log(`[seed]   canonical rewrite: ${row.url} → ${normCanonical}`);
              row.url = normCanonical;
            }
          }
        }
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
      published_at:   r.published_at  ?? null,
      seeder_score:   typeof r.seeder_score === 'number'
                        ? Math.min(Math.max(r.seeder_score, 0), 1)
                        : 0,
      approved:       true,
      wilson_score:   0,
      upvotes:        0,
      downvotes:      0,
    }));

    let { error, count } = await supabase
      .from('urls')
      .upsert(batch, { onConflict: 'url', ignoreDuplicates: true })
      .select('id', { count: 'exact', head: true });

    // Graceful degradation: if new columns don't exist yet in the DB schema
    // (migration not yet applied), retry the batch without them.
    if (error?.message?.includes('published_at') || error?.message?.includes('seeder_score')) {
      console.warn(`[seed] Schema missing new columns — retrying without published_at/seeder_score (run migration 20260503000004)`);
      const batchCompat = batch.map(({ published_at, seeder_score, ...rest }) => rest);
      ({ error, count } = await supabase
        .from('urls')
        .upsert(batchCompat, { onConflict: 'url', ignoreDuplicates: true })
        .select('id', { count: 'exact', head: true }));
    }

    if (error) {
      console.error(`[seed] Upsert error on batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
    } else {
      inserted += count ?? batch.length;
      log(`[seed] Batch ${Math.floor(i / BATCH_SIZE) + 1}: upserted ${batch.length} rows`);
    }
  }

  if (checkLive) {
    log(`[seed] Done. Inserted: ${inserted}, Skipped: ${existingSet.size}, Dead: ${dead}`);
    return { inserted, skipped: existingSet.size, dead };
  }
  log(`[seed] Done. Inserted: ${inserted}, Skipped: ${existingSet.size}`);
  return { inserted, skipped: existingSet.size, dead: 0 };
}

// ── Category / subcategory ID helpers ────────────────────────────────────────
// Fixed UUIDs matching the migration seed data.
// UUID scheme for categories:    c1{000000}-0000-0000-0000-{pillar:012d}
// UUID scheme for subcategories: c2{pillar:06d}-0000-0000-0000-{sort:012d}
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

export const SUBCATEGORY = {
  // 🔬 Science & Nature
  SPACE_ASTRONOMY:           'c2000001-0000-0000-0000-000000000001',
  BIOLOGY_EVOLUTION:         'c2000001-0000-0000-0000-000000000002',
  PHYSICS_CHEMISTRY:         'c2000001-0000-0000-0000-000000000003',
  ENVIRONMENT_CLIMATE:       'c2000001-0000-0000-0000-000000000004',
  MEDICINE_HEALTH_SCIENCE:   'c2000001-0000-0000-0000-000000000005',
  MATHEMATICS_LOGIC:         'c2000001-0000-0000-0000-000000000006',
  GEOLOGY_EARTH_SCIENCE:     'c2000001-0000-0000-0000-000000000007',
  OCEANOGRAPHY_MARINE_LIFE:  'c2000001-0000-0000-0000-000000000008',
  PALEONTOLOGY_NATURAL_HISTORY: 'c2000001-0000-0000-0000-000000000009',

  // 💻 Technology
  PROGRAMMING_SOFTWARE:      'c2000002-0000-0000-0000-000000000001',
  DESIGN_UX:                 'c2000002-0000-0000-0000-000000000002',
  AI_MACHINE_LEARNING:       'c2000002-0000-0000-0000-000000000003',
  HARDWARE_ELECTRONICS:      'c2000002-0000-0000-0000-000000000004',
  CYBERSECURITY_PRIVACY:     'c2000002-0000-0000-0000-000000000005',
  INTERNET_CULTURE:          'c2000002-0000-0000-0000-000000000006',
  ROBOTICS_AUTOMATION:       'c2000002-0000-0000-0000-000000000007',
  EMERGING_TECHNOLOGY:       'c2000002-0000-0000-0000-000000000008',
  OPEN_SOURCE:               'c2000002-0000-0000-0000-000000000009',

  // 🎨 Arts & Culture
  MUSIC:                     'c2000003-0000-0000-0000-000000000001',
  FILM_TELEVISION:           'c2000003-0000-0000-0000-000000000002',
  VISUAL_ART:                'c2000003-0000-0000-0000-000000000003',
  COMICS_ILLUSTRATION:       'c2000003-0000-0000-0000-000000000004',
  LITERATURE_WRITING:        'c2000003-0000-0000-0000-000000000005',
  PHOTOGRAPHY:               'c2000003-0000-0000-0000-000000000006',
  ARCHITECTURE_URBAN:        'c2000003-0000-0000-0000-000000000007',
  THEATRE_PERFORMANCE:       'c2000003-0000-0000-0000-000000000008',
  FASHION_TEXTILES:          'c2000003-0000-0000-0000-000000000009',
  ANIME_MANGA:               'c2000003-0000-0000-0000-000000000010',
  SCIFI_FANTASY:             'c2000003-0000-0000-0000-000000000011',

  // 📜 History & Ideas
  ANCIENT_MEDIEVAL_HISTORY:  'c2000004-0000-0000-0000-000000000001',
  MODERN_HISTORY:            'c2000004-0000-0000-0000-000000000002',
  PHILOSOPHY_ETHICS:         'c2000004-0000-0000-0000-000000000003',
  POLITICS_GEOPOLITICS:      'c2000004-0000-0000-0000-000000000004',
  RELIGION_MYTHOLOGY:        'c2000004-0000-0000-0000-000000000005',
  ANTHROPOLOGY_ARCHAEOLOGY:  'c2000004-0000-0000-0000-000000000006',
  ECONOMICS_HISTORY:         'c2000004-0000-0000-0000-000000000007',
  SOCIAL_HISTORY:            'c2000004-0000-0000-0000-000000000008',
  MILITARY_HISTORY:          'c2000004-0000-0000-0000-000000000009',

  // 🎮 Games & Hobbies
  VIDEO_GAMES:               'c2000005-0000-0000-0000-000000000001',
  BOARD_GAMES_TABLETOP:      'c2000005-0000-0000-0000-000000000002',
  SPORTS_ATHLETICS:          'c2000005-0000-0000-0000-000000000003',
  COOKING_FOOD:              'c2000005-0000-0000-0000-000000000004',
  CRAFTS_DIY_MAKING:         'c2000005-0000-0000-0000-000000000005',
  COLLECTING:                'c2000005-0000-0000-0000-000000000006',
  OUTDOOR_ADVENTURE:         'c2000005-0000-0000-0000-000000000007',
  GARDENING_HORTICULTURE:    'c2000005-0000-0000-0000-000000000008',
  PUZZLES_BRAIN_TEASERS:     'c2000005-0000-0000-0000-000000000009',
  BROWSER_INTERACTIVE:       'c2000005-0000-0000-0000-000000000010',
  PETS:                      'c2000005-0000-0000-0000-000000000011',
  FISHING:                   'c2000005-0000-0000-0000-000000000012',

  // 🌀 Weird & Wonderful
  ODDITIES_CURIOSITIES:      'c2000006-0000-0000-0000-000000000001',
  TRUE_CRIME_MYSTERIES:      'c2000006-0000-0000-0000-000000000002',
  PARANORMAL_UNEXPLAINED:    'c2000006-0000-0000-0000-000000000003',
  VINTAGE_INTERNET:          'c2000006-0000-0000-0000-000000000004',
  ABSURDIST_HUMOUR:          'c2000006-0000-0000-0000-000000000005',
  URBAN_LEGENDS_FOLKLORE:    'c2000006-0000-0000-0000-000000000006',
  CONSPIRACY_FRINGE:         'c2000006-0000-0000-0000-000000000007',
  UNUSUAL_PLACES:            'c2000006-0000-0000-0000-000000000008',
  LOST_MEDIA:                'c2000006-0000-0000-0000-000000000009',

  // 🌍 People & Places
  TRAVEL_EXPLORATION:        'c2000007-0000-0000-0000-000000000001',
  CITIES_URBAN_LIFE:         'c2000007-0000-0000-0000-000000000002',
  BIOGRAPHIES_PROFILES:      'c2000007-0000-0000-0000-000000000003',
  LANGUAGES_LINGUISTICS:     'c2000007-0000-0000-0000-000000000004',
  INDIGENOUS_CULTURES:       'c2000007-0000-0000-0000-000000000005',
  SUBCULTURES_COMMUNITIES:   'c2000007-0000-0000-0000-000000000006',
  MIGRATION_DIASPORA:        'c2000007-0000-0000-0000-000000000007',
  MAPS_CARTOGRAPHY:          'c2000007-0000-0000-0000-000000000008',
  FESTIVALS_CUSTOMS:         'c2000007-0000-0000-0000-000000000009',

  // 🧠 Mind & Body
  PSYCHOLOGY_BEHAVIOUR:      'c2000008-0000-0000-0000-000000000001',
  MENTAL_HEALTH:             'c2000008-0000-0000-0000-000000000002',
  FITNESS_MOVEMENT:          'c2000008-0000-0000-0000-000000000003',
  NUTRITION_HEALTH:          'c2000008-0000-0000-0000-000000000004',
  NEUROSCIENCE:              'c2000008-0000-0000-0000-000000000005',
  MINDFULNESS_MEDITATION:    'c2000008-0000-0000-0000-000000000006',
  SLEEP_RECOVERY:            'c2000008-0000-0000-0000-000000000007',
  RELATIONSHIPS_SOCIAL:      'c2000008-0000-0000-0000-000000000008',
  PERSONAL_DEVELOPMENT:      'c2000008-0000-0000-0000-000000000009',
};

/** @deprecated Use SUBCATEGORY constants instead — no DB round-trip needed. */
export async function getSubcategoryId(name) {
  const { data } = await supabase
    .from('subcategories')
    .select('id')
    .ilike('name', `%${name}%`)
    .limit(1)
    .single();
  return data?.id ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Discovery Helpers
// ═══════════════════════════════════════════════════════════════════════════════

const SKIP_STRS = [
  "/tag/", "/author/", "/about", "/search", "/video", "/gallery",
  "/subscribe", "/newsletter", "/account", "/login", "/register",
  "/share", "/store", "/members", "/classifieds", "/bidding",
  "/results", "/shop", "/careers", "/podcast", "/scoreboard",
  "/schedule", "/standings", "/stats", "/watch", "/fantasy",
  "/markets", "/quote", "/category/", "/page/", "/feed",
  "/rss", "/atom",
];

function _filterUrl(link, articlePathRegex, skipPaths, seenUrls) {
  if (seenUrls.has(link)) return false;
  let pathname = "";
  try { pathname = new URL(link).pathname; } catch { return false; }
  if (!pathname || pathname === "/") return false;
  if (SKIP_STRS.some((s) => pathname.includes(s))) return false;
  if (skipPaths.some((r) => r.test(pathname))) return false;
  if (!articlePathRegex.test(pathname)) return false;
  return true;
}

function _normUrl(raw) {
  try { const u = new URL(raw); u.hash = ""; return u.toString(); } catch { return null; }
}

/**
 * Parse RSS/Atom feed text into { url, feedTitle, feedDesc, feedDate } entries.
 * Returns empty array if text is neither RSS nor Atom.
 */
function _parseFeedXml(text, feedUrl, articlePathRegex, skipPaths, siteSuffixRegex, maxArticles, seenUrls) {
  const isAtom = /<feed[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(text);
  const entryRe = isAtom ? /<entry[\s\S]*?<\/entry>/gi : /<item[\s\S]*?<\/item>/gi;
  const results = [];
  let entryMatch;
  while ((entryMatch = entryRe.exec(text)) !== null) {
    const block = entryMatch[0];
    const atomLink = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    const rssLink = block.match(/<link>([^<]+)<\/link>/i);
    const raw = atomLink?.[1]?.trim() ?? rssLink?.[1]?.trim() ?? null;
    if (!raw) continue;
    let link = _normUrl(raw);
    if (!link) continue;
    if (seenUrls.has(link)) continue;
    let pathname = "";
    try { pathname = new URL(link).pathname; } catch { continue; }
    if (!pathname || pathname === "/") continue;
    if (SKIP_STRS.some((s) => pathname.includes(s))) continue;
    if (skipPaths.some((r) => r.test(pathname))) continue;
    if (!articlePathRegex.test(pathname)) continue;
    seenUrls.add(link);

    const atomTitle = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const cdataTitle = block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i);
    let feedTitle = cdataTitle?.[1]?.trim() ?? atomTitle?.[1]?.trim() ?? null;
    if (feedTitle) feedTitle = feedTitle.replace(/<[^>]+>/g, "").replace(siteSuffixRegex, "").trim();

    const atomDesc = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
    const cdataDesc = block.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i);
    const rawDesc = cdataDesc?.[1] ?? atomDesc?.[1] ?? null;
    let feedDesc = null;
    if (rawDesc) feedDesc = rawDesc.replace(/<[^>]+>/g, "").trim().slice(0, 500);

    const atomDate = block.match(/<published[^>]*>([^<]+)<\/published>/i) ??
      block.match(/<updated[^>]*>([^<]+)<\/updated>/i);
    const rssDate = block.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i) ??
      block.match(/<lastBuildDate[^>]*>([^<]+)<\/lastBuildDate>/i);
    const feedDate = atomDate?.[1]?.trim() ?? rssDate?.[1]?.trim() ?? null;

    results.push({ url: link, feedTitle, feedDesc, feedDate });
    if (results.length >= maxArticles) break;
  }
  return results;
}

// ── Tier 2: RSS from common paths ──────────────────────────────────────────
async function _discoverRssCommonPaths({ siteDomain, articlePathRegex, skipPaths, siteSuffixRegex, UA, maxArticles }) {
  const paths = ["/feed/", "/rss/", "/atom.xml", "/feed.xml", "/index.xml", "/rss.xml"];
  const results = [];
  const seenUrls = new Set();
  for (const path of paths) {
    try {
      const res = await fetchWithRetry(`https://${siteDomain}${path}`, {
        headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (text.length < 50) continue;
      results.push(..._parseFeedXml(text, path, articlePathRegex, skipPaths, siteSuffixRegex, maxArticles, seenUrls));
    } catch { /* skip */ }
  }
  return results;
}

// ── Tier 3: JSON Feed ─────────────────────────────────────────────────────
async function _discoverJsonFeed({ siteDomain, articlePathRegex, skipPaths, UA }) {
  const paths = ["/feed.json", "/feed/index.json"];
  const results = [];
  const seenUrls = new Set();
  for (const path of paths) {
    try {
      const res = await fetchWithRetry(`https://${siteDomain}${path}`, {
        headers: { "User-Agent": UA, Accept: "application/json, */*" },
      });
      if (!res.ok) continue;
      const json = await res.json();
      const items = json?.items ?? [];
      for (const item of items) {
        if (!item.url) continue;
        let link = _normUrl(item.url);
        if (!link) continue;
        if (seenUrls.has(link)) continue;
        let pathname = "";
        try { pathname = new URL(link).pathname; } catch { continue; }
        if (!pathname || pathname === "/") continue;
        if (SKIP_STRS.some((s) => pathname.includes(s))) continue;
        if (skipPaths.some((r) => r.test(pathname))) continue;
        if (!articlePathRegex.test(pathname)) continue;
        seenUrls.add(link);
        results.push({
          url: link,
          feedTitle: item.title ?? null,
          feedDesc: (item.summary ?? item.content_text ?? "").slice(0, 500) || null,
          feedDate: item.date_published ?? null,
        });
      }
    } catch { /* skip */ }
  }
  return results;
}

// ── Tier 4: robots.txt sitemap discovery ───────────────────────────────────
async function _discoverRobotsTxt({ siteDomain, UA }) {
  try {
    const res = await fetchWithRetry(`https://${siteDomain}/robots.txt`, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    const text = await res.text();
    const sitemaps = [];
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^sitemap:\s*(.+)/i);
      if (m) {
        const url = m[1].trim();
        if (url.startsWith("http")) sitemaps.push(url);
      }
    }
    return sitemaps;
  } catch { return []; }
}

// ── Tier 5: WordPress REST API ─────────────────────────────────────────────
async function _discoverWpApi({ siteDomain, articlePathRegex, skipPaths, UA }) {
  try {
    // Try with _fields first, fall back to full response
    for (const query of [
      "per_page=100&_fields=link,title.rendered,excerpt.rendered",
      "per_page=100",
    ]) {
      const res = await fetchWithRetry(`https://${siteDomain}/wp-json/wp/v2/posts?${query}`, {
        headers: { "User-Agent": UA, Accept: "application/json, */*" },
      });
      if (!res.ok) continue;
      const posts = await res.json();
      if (!Array.isArray(posts)) continue;
      const results = [];
      const seenUrls = new Set();
      for (const post of posts) {
        const raw = post.link;
        if (!raw) continue;
        let link = _normUrl(raw);
        if (!link) continue;
        if (seenUrls.has(link)) continue;
        let pathname = "";
        try { pathname = new URL(link).pathname; } catch { continue; }
        if (!pathname || pathname === "/") continue;
        if (SKIP_STRS.some((s) => pathname.includes(s))) continue;
        if (skipPaths.some((r) => r.test(pathname))) continue;
        if (!articlePathRegex.test(pathname)) continue;
        seenUrls.add(link);
        results.push({
          url: link,
          feedTitle: typeof post.title === "object" ? post.title?.rendered : (post.title ?? null),
          feedDesc: (() => {
            const excerpt = typeof post.excerpt === "object" ? post.excerpt?.rendered : null;
            if (!excerpt) return null;
            return excerpt.replace(/<[^>]+>/g, "").trim().slice(0, 500);
          })(),
          feedDate: post.date ?? null,
        });
      }
      if (results.length) return results;
    }
  } catch { /* skip */ }
  return [];
}

// ── Tier 7: Homepage HTTP Link + HTML <link> RSS autodiscovery ─────────────
async function _discoverRssAuto({ siteDomain, articlePathRegex, skipPaths, siteSuffixRegex, UA, maxArticles }) {
  const homepageUrl = `https://${siteDomain}`;
  try {
    const res = await fetchWithRetry(homepageUrl, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    const html = await res.text();
    const feedUrls = new Set();

    // HTTP Link header
    const linkHeader = res.headers.get("link");
    if (linkHeader) {
      const linkRe = /<([^>]+)>;\s*rel=["'](?:alternate|feed)["'];\s*type=["']application\/(?:rss\+xml|atom\+xml)["']/gi;
      let m;
      while ((m = linkRe.exec(linkHeader)) !== null) {
        try { feedUrls.add(new URL(m[1], homepageUrl).toString()); } catch { /* skip */ }
      }
    }

    // HTML <link> tags
    const htmlLinkRe = /<link[^>]+(?:rel=["'](?:alternate|feed)["'][^>]+type=["']application\/(?:rss\+xml|atom\+xml)["']|type=["']application\/(?:rss\+xml|atom\+xml)["'][^>]+rel=["'](?:alternate|feed)["'])[^>]+href=["']([^"']+)["']/gi;
    let fm;
    while ((fm = htmlLinkRe.exec(html)) !== null) {
      try { feedUrls.add(new URL(fm[1], homepageUrl).toString()); } catch { /* skip */ }
    }

    if (!feedUrls.size) return [];

    const results = [];
    const seenUrls = new Set();
    for (const feedUrl of feedUrls) {
      try {
        const feedRes = await fetchWithRetry(feedUrl, {
          headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
        });
        if (!feedRes.ok) continue;
        const text = await feedRes.text();
        if (text.length < 50) continue;
        results.push(..._parseFeedXml(text, feedUrl, articlePathRegex, skipPaths, siteSuffixRegex, maxArticles, seenUrls));
      } catch { /* skip */ }
    }
    return results;
  } catch {
    return [];
  }
}

// ── Tier 8: Archive page anchor scraping (with pagination) ─────────────────
async function _discoverArchivePages({ siteDomain, articlePathRegex, skipPaths, UA }) {
  const archivePaths = ["/blog/", "/news/", "/articles/", "/posts/", "/latest/", "/archive/"];
  const results = [];
  const seenUrls = new Set();
  // Also try paginated pages for each archive path
  const pageSuffixes = [""];
  for (let p = 2; p <= 5; p++) pageSuffixes.push(`/page/${p}`);

  for (const path of archivePaths) {
    for (const suffix of pageSuffixes) {
      try {
        const res = await fetchWithRetry(`https://${siteDomain}${path}${suffix}`, { headers: { "User-Agent": UA } });
        if (!res.ok) continue;
        const html = await res.text();
        const anchorRe = /<a\s[^>]*href=["']([^"'\s]*)["'][^>]*>/gi;
        let am;
        while ((am = anchorRe.exec(html)) !== null) {
          const raw = am[1];
          if (!raw || raw === "/" || raw.startsWith("#") || raw.startsWith("javascript:")) continue;
          try {
            const u = new URL(raw, `https://${siteDomain}`);
            u.hash = "";
            const link = u.toString();
            if (seenUrls.has(link)) continue;
            const pathname = u.pathname;
            if (!pathname || pathname === "/") continue;
            if (SKIP_STRS.some((s) => pathname.includes(s))) continue;
            if (skipPaths.some((r) => r.test(pathname))) continue;
            if (!articlePathRegex.test(pathname)) continue;
            seenUrls.add(link);
            results.push({ url: link });
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
  }
  return results;
}

// ── Tier 9: Homepage JSON-LD itemListElement extraction ────────────────────
async function _discoverJsonLdHomepage({ siteDomain, articlePathRegex, skipPaths, UA }) {
  try {
    const res = await fetchWithRetry(`https://${siteDomain}`, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    const html = await res.text();
    const results = [];
    const seenUrls = new Set();

    // Find all JSON-LD blocks
    const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let ldMatch;
    while ((ldMatch = ldRe.exec(html)) !== null) {
      try {
        const ld = JSON.parse(ldMatch[1]);
        const items = ld["@graph"] || [ld];
        for (const item of items) {
          // Look for ItemList or WebSite containing itemListElement
          const elements = item.itemListElement || item.mainEntity?.itemListElement || [];
          for (const elem of elements) {
            const raw = elem.url || elem.item?.url;
            if (!raw) continue;
            let link = _normUrl(raw);
            if (!link) continue;
            if (seenUrls.has(link)) continue;
            let pathname = "";
            try { pathname = new URL(link).pathname; } catch { continue; }
            if (!pathname || pathname === "/") continue;
            if (SKIP_STRS.some((s) => pathname.includes(s))) continue;
            if (skipPaths.some((r) => r.test(pathname))) continue;
            if (!articlePathRegex.test(pathname)) continue;
            seenUrls.add(link);
            results.push({ url: link });
          }
        }
      } catch { /* malformed JSON-LD — skip */ }
    }
    return results;
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Unified Discovery Orchestrator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Runs all discovery methods in priority order. Stops at the first tier
 * that returns ≥10 URLs. Returns { entries, method } where entries is
 * [{ url, feedTitle, feedDesc, feedDate, timestamp? }] and method is the
 * name of the winning tier.
 */
async function _discoverAll({ siteDomain, articlePathRegex, skipPaths, siteSuffixRegex, feedUrl, UA, maxArticles, maxPages }) {
  let entries = [];
  let method = "none";

  // Tier 1: Configured RSS feed
  if (feedUrl) {
    console.log(`\n📡 Tier 1: RSS feed (${feedUrl})...`);
    try {
      const res = await fetchWithRetry(feedUrl, { headers: { "User-Agent": UA } });
      if (res.ok) {
        const text = await res.text();
        if (text.length >= 50) {
          const seen = new Set();
          entries = _parseFeedXml(text, feedUrl, articlePathRegex, skipPaths, siteSuffixRegex, maxArticles, seen);
          if (entries.length >= 10) {
            method = "RSS";
            console.log(`  ✓ RSS: ${entries.length} article URLs`);
            return { entries, method };
          }
        }
      }
    } catch { /* skip */ }
    console.log(`  [RSS] <10 or failed, falling back...`);
  }

  // Tier 2: RSS from common paths
  console.log(`\n📡 Tier 2: RSS common paths...`);
  entries = await _discoverRssCommonPaths({ siteDomain, articlePathRegex, skipPaths, siteSuffixRegex, UA, maxArticles });
  if (entries.length >= 10) { method = "RSS-common"; console.log(`  ✓ RSS-common: ${entries.length} article URLs`); return { entries, method }; }
  console.log(`  [RSS-common] <10 or failed, falling back...`);

  // Tier 3: JSON Feed
  console.log(`\n📡 Tier 3: JSON Feed...`);
  entries = await _discoverJsonFeed({ siteDomain, articlePathRegex, skipPaths, UA });
  if (entries.length >= 10) { method = "JSON Feed"; console.log(`  ✓ JSON Feed: ${entries.length} article URLs`); return { entries, method }; }
  console.log(`  [JSON Feed] <10 or failed, falling back...`);

  // Tier 4: robots.txt + Sitemap
  console.log(`\n📡 Tier 4: robots.txt + Sitemap...`);
  entries = [];
  const robotSitemaps = await _discoverRobotsTxt({ siteDomain, UA });
  // Merge with hardcoded sitemap paths
  const sitemapPaths = ["/sitemap.xml", "/sitemap_index.xml", "/news_sitemap.xml", "/news-sitemap.xml", "/wp-sitemap.xml", "/sitemap-index.xml", "/post-sitemap.xml", "/page-sitemap.xml", "/sitemap?page=1"];
  const allSitemapUrls = [...robotSitemaps, ...sitemapPaths.map(p => `https://${siteDomain}${p}`)];
  const seenUrls = new Set();

  async function _parseSitemap(sitemapUrl) {
    if (seenUrls.has(sitemapUrl)) return;
    seenUrls.add(sitemapUrl);
    try {
      const res = await fetchWithRetry(sitemapUrl, { headers: { "User-Agent": UA } });
      if (!res.ok) return;
      const text = await res.text();
      if (/<sitemapindex/i.test(text)) {
        for (const m of text.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
          const url = m[1].trim();
          if (url.startsWith("http") && !seenUrls.has(url)) { await _parseSitemap(url); }
        }
        return;
      }
      for (const m of text.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/gi)) {
        let loc = _normUrl(m[1].trim());
        if (!loc) continue;
        const link = _normUrl(loc);
        if (link && _filterUrl(link, articlePathRegex, skipPaths, seenUrls)) {
          seenUrls.add(link);
          entries.push({ url: link, feedTitle: null, feedDesc: null, feedDate: null });
          if (entries.length >= maxArticles) return;
        }
      }
    } catch { /* skip */ }
  }

  for (const sitemapUrl of allSitemapUrls) {
    if (entries.length >= maxArticles) break;
    await _parseSitemap(sitemapUrl);
  }
  if (entries.length >= 10) { method = "sitemap"; console.log(`  ✓ Sitemap: ${entries.length} article URLs`); return { entries, method }; }
  console.log(`  [Sitemap] <10 or failed, falling back...`);

  // Tier 5: WordPress REST API
  console.log(`\n📡 Tier 5: WordPress REST API...`);
  entries = await _discoverWpApi({ siteDomain, articlePathRegex, skipPaths, UA });
  if (entries.length >= 10) { method = "WP API"; console.log(`  ✓ WP API: ${entries.length} article URLs`); return { entries, method }; }
  console.log(`  [WP API] <10 or failed, falling back...`);

  // Tier 6: Wayback CDX
  entries = []; // reset; CDX results handled by caller in seedWaybackCdx, but we provide the function reference
  // Actually let the caller handle CDX separately since it needs specialized metadata fetching

  // Tier 7: Homepage RSS/Atom autodiscovery (HTTP Link + HTML <link>)
  console.log(`\n📡 Tier 7: Homepage RSS autodiscovery...`);
  entries = await _discoverRssAuto({ siteDomain, articlePathRegex, skipPaths, siteSuffixRegex, UA, maxArticles });
  if (entries.length >= 10) { method = "RSS-auto"; console.log(`  ✓ RSS-auto: ${entries.length} article URLs`); return { entries, method }; }
  console.log(`  [RSS-auto] <10 or failed, falling back...`);

  // Tier 8: Archive page scraping
  console.log(`\n📡 Tier 8: Archive page scraping...`);
  entries = await _discoverArchivePages({ siteDomain, articlePathRegex, skipPaths, UA });
  if (entries.length >= 10) { method = "archive-scrape"; console.log(`  ✓ Archive-scrape: ${entries.length} article URLs`); return { entries, method }; }
  console.log(`  [Archive-scrape] <10 or failed.`);

  return { entries, method };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Wayback CDX Seeder
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Shared Wayback Machine CDX seeder — discovers and fetches article metadata
 * via the Wayback Machine for sites behind bot protection.
 *
 * Uses the proven pattern from seed-iflscience.mjs:
 *   1. Query CDX API with output=json + fl=timestamp,original (NO matchType=prefix)
 *   2. Fetch snapshot HTML directly using timestamps from CDX (NO wayback/available)
 *   3. Extract title, description, og:image from snapshot HTML
 *   4. Submit to DB via upsertUrls()
 *
 * @param {{
 *   siteDomain: string,
 *   cacheFileName: string,
 *   displayName: string,
 *   articlePathRegex: RegExp,
 *   skipPaths?: RegExp[],
 *   siteSuffixRegex: RegExp,
 *   category_id: string,
 *   subcategory_id: string,
 *   source: string,
 *   seeder_score?: number,
 *   maxPages?: number,
 * }} config
 */
export async function seedWaybackCdx(config) {
  const {
    siteDomain,
    cacheFileName,
    displayName,
    articlePathRegex,
    skipPaths = [],
    siteSuffixRegex,
    category_id,
    subcategory_id,
    source,
    seeder_score = 0.7,
    maxPages = 40,
  } = config;

  const CACHE_DIR = resolve(__dirname, "../.cache");
  const CACHE_FILE = resolve(CACHE_DIR, cacheFileName);
  mkdirSync(CACHE_DIR, { recursive: true });

  const NO_CACHE = process.argv.includes("--no-cache");
  const UA = "Roam-Seeder/1.0 (+https://roamtheweb.app)";
  const CDX_LIMIT = 500;
  const SNAPSHOT_DELAY_MS = 400;
  const CDX_DELAY_MS = 600;

  const sleep_ = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── Sitemap Discovery (fallback) ───────────────────────────────────────────
  /**
   * Try common sitemap URLs for a domain. Returns an array of { url } objects
   * (no timestamp — sitemap URLs are live, not Wayback snapshots).
   */
  async function discoverUrlsFromSitemap() {
    const sitemapPaths = [
      "/sitemap.xml",
      "/sitemap_index.xml",
      "/news_sitemap.xml",        // Google News sitemap (recent articles)
      "/news-sitemap.xml",         // variant
      "/wp-sitemap.xml",           // WordPress
      "/sitemap-index.xml",        // common variant
      "/post-sitemap.xml",         // Yoast SEO
      "/page-sitemap.xml",         // Yoast SEO
      "/sitemap?page=1",           // some custom setups
    ];

    const seenUrls = new Set();
    const results = [];

    // Helper: fetch and parse a single sitemap XML, extract <loc> URLs
    async function parseSitemap(sitemapUrl) {
      if (seenUrls.has(sitemapUrl)) return;
      seenUrls.add(sitemapUrl);

      try {
        const res = await fetchWithRetry(sitemapUrl, { headers: { "User-Agent": UA } });
        if (!res.ok) return;
        const text = await res.text();

        // Sitemap index: extract sub-sitemap URLs (supports <sitemapindex> and <urlset xmlns:news="...">)
        if (/<sitemapindex/i.test(text)) {
          const matches = text.matchAll(/<loc>([^<]+)<\/loc>/gi);
          for (const m of matches) {
            const url = m[1].trim();
            if (url.startsWith("http") && !seenUrls.has(url)) {
              await parseSitemap(url);
            }
          }
          return;
        }

        // Regular or News sitemap: extract <url><loc> entries
        const urlMatches = text.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/gi);
        for (const m of urlMatches) {
          let loc = m[1].trim();
          // Normalize
          try {
            const u = new URL(loc);
            u.hash = "";
            loc = u.toString();
          } catch { continue; }

          let pathname = "";
          try { pathname = new URL(loc).pathname; } catch { continue; }
          if (!pathname || pathname === "/") continue;

          // Apply same skip filters
          const skipStrs = [
            "/tag/", "/author/", "/about", "/search", "/video", "/gallery",
            "/subscribe", "/newsletter", "/account", "/login", "/register",
            "/share", "/store", "/members", "/classifieds", "/bidding",
            "/results", "/shop", "/careers", "/podcast", "/scoreboard",
            "/schedule", "/standings", "/stats", "/watch", "/fantasy",
            "/markets", "/quote", "/category/", "/page/",
          ];
          if (skipStrs.some((s) => pathname.includes(s))) continue;
          if (skipPaths.some((r) => r.test(pathname))) continue;
          if (!articlePathRegex.test(pathname)) continue;

          if (seenUrls.has(loc)) continue;
          seenUrls.add(loc);
          results.push({ url: loc, timestamp: null }); // null timestamp = live URL
        }
      } catch {
        // skip unreachable sitemaps silently
      }
    }

    // Try each sitemap root path
    for (const path of sitemapPaths) {
      const sitemapUrl = `https://${siteDomain}${path}`;
      console.log(`  [Sitemap] Trying ${sitemapUrl}...`);
      await parseSitemap(sitemapUrl);
      if (results.length > 0) {
        console.log(`  [Sitemap] Found ${results.length} article URLs via ${path}`);
        break; // stop after first working sitemap
      }
    }

    return results;
  }

  // ── RSS Autodiscovery (2nd fallback) ─────────────────────────────────────
  async function discoverUrlsFromRssAutodiscovery() {
    console.log(`  [RSS-Auto] Scanning homepage...`);
    const entries = await _discoverRssAuto({ siteDomain, articlePathRegex, skipPaths, siteSuffixRegex, UA, maxArticles: 2000 });
    const results = entries.map(e => ({ url: e.url, timestamp: null }));
    console.log(`  [RSS-Auto] Extracted ${results.length} article URLs`);
    return results;
  }

  // ── CDX Discovery ──────────────────────────────────────────────────────────
  async function discoverUrls() {
    const results = [];
    const seenUrls = new Set();

    // Try matchType=host first (default with wildcard), then fall back to matchType=domain for subdomains
    for (const matchType of [undefined, "domain"]) {
      for (let page = 0; page < Math.ceil(maxPages / 2); page++) {
        const matchParam = matchType ? `&matchType=${matchType}` : "";
        const cdxUrl =
          `https://web.archive.org/cdx/search/cdx?url=*.${siteDomain}/*&output=json&limit=${CDX_LIMIT}&filter=statuscode:200&collapse=urlkey&fl=timestamp,original${matchParam}`;

      let data = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const res = await fetchWithRetry(cdxUrl, { headers: { "User-Agent": UA } });
          const text = await res.text();
          if (res.ok && text.startsWith("[")) {
            try { data = JSON.parse(text); } catch { data = null; }
            break;
          }
          if (res.status === 429 || res.status >= 500) {
            console.warn(`  [CDX] ${res.status}, retry ${attempt + 1}/4...`);
            await sleep_(2000 * (attempt + 1));
            continue;
          }
          console.warn(`  [CDX] HTTP ${res.status}`);
          break;
        } catch (err) {
          if (attempt === 3) console.warn(`  [CDX] Fetch error: ${err.message}`);
          else await sleep_(2000 * (attempt + 1));
        }
      }

      if (!data || data.length <= 1) {
        if (data && data.length === 0) break;
        if (!data) break;
        continue;
      }

      for (let i = 1; i < data.length; i++) {
        const [timestamp, originalUrl] = data[i];
        let pathname = "";
        try { pathname = new URL(originalUrl).pathname; } catch { continue; }
        if (!pathname || pathname === "/") continue;

        // Skip non-article paths
        const skipStrs = [
          "/tag/", "/author/", "/about", "/search", "/video", "/gallery",
          "/subscribe", "/newsletter", "/account", "/login", "/register",
          "/share", "/store", "/members", "/classifieds", "/bidding",
          "/results", "/shop", "/careers", "/podcast", "/scoreboard",
          "/schedule", "/standings", "/stats", "/watch", "/fantasy",
          "/markets", "/quote",
        ];
        if (skipStrs.some((s) => pathname.includes(s))) continue;
        if (skipPaths.some((r) => r.test(pathname))) continue;
        if (!articlePathRegex.test(pathname)) continue;

        // Normalize URL
        let url = originalUrl.replace(/^http:\/\//, "https://");
        try {
          const u = new URL(url);
          u.hash = "";
          url = u.toString();
        } catch { /* keep original */ }

        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        results.push({ url, timestamp });
      }

      console.log(`  Page ${page + 1}/${maxPages}: ${results.length} URLs so far`);

        if (data.length < CDX_LIMIT + 1) break; // No more results
        await sleep_(CDX_DELAY_MS);
      }
    }

    return results;
  }

  // ── Fetch article metadata from Wayback snapshot ───────────────────────────
  async function fetchArticleMeta(article) {
    const wbUrl = `https://web.archive.org/web/${article.timestamp}/${article.url}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const res = await fetchWithRetry(wbUrl, {
        headers: { "User-Agent": UA },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const contentLen = parseInt(res.headers.get("content-length") || "0");
      if (contentLen > 2_000_000) { clearTimeout(timer); return null; }

      const html = await res.text();
      clearTimeout(timer);

      // Title
      let title = null;
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim().replace(siteSuffixRegex, "").trim();
      }
      if (!title) {
        const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
        if (ogTitle) title = ogTitle[1].trim().replace(siteSuffixRegex, "").trim();
        else {
          const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
          if (h1) title = h1[1].trim();
        }
      }

      // Description
      let description = null;
      const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
      const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      const rawDesc = ogDesc?.[1]?.trim() ?? metaDesc?.[1]?.trim() ?? null;
      if (rawDesc) description = rawDesc.slice(0, 500);

      // OG Image
      let og_image_url = null;
      const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      if (ogImg) og_image_url = ogImg[1].trim();
      if (!og_image_url) {
        const twImg = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
        if (twImg) og_image_url = twImg[1].trim();
      }

      return { title, description, og_image_url };
    } catch {
      return null;
    }
  }

  // ── Fetch metadata from a LIVE URL (used for sitemap-discovered URLs) ──────
  async function fetchArticleMetaLive(article) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const res = await fetchWithRetry(article.url, {
        headers: { "User-Agent": UA },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const contentLen = parseInt(res.headers.get("content-length") || "0");
      if (contentLen > 2_000_000) { clearTimeout(timer); return null; }

      const html = await res.text();
      clearTimeout(timer);

      // Title
      let title = null;
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim().replace(siteSuffixRegex, "").trim();
      }
      if (!title) {
        const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
        if (ogTitle) title = ogTitle[1].trim().replace(siteSuffixRegex, "").trim();
        else {
          const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
          if (h1) title = h1[1].trim();
        }
      }

      // Description
      let description = null;
      const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
      const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      const rawDesc = ogDesc?.[1]?.trim() ?? metaDesc?.[1]?.trim() ?? null;
      if (rawDesc) description = rawDesc.slice(0, 500);

      // OG Image
      let og_image_url = null;
      const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      if (ogImg) og_image_url = ogImg[1].trim();
      if (!og_image_url) {
        const twImg = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
        if (twImg) og_image_url = twImg[1].trim();
      }

      return { title, description, og_image_url };
    } catch {
      return null;
    }
  }

  // ── Main ───────────────────────────────────────────────────────────────────
  const startTime = Date.now();
  console.log(`${displayName} Seeder (Wayback Machine: CDX → Sitemap → RSS Auto)\n`);

  let cache = {};
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
      console.log(`📦 Loaded cache: ${(cache.discovered || []).length} URLs discovered, ${Object.keys(cache.fetched || {}).length} fetched`);
    } catch { cache = {}; }
  }
  if (NO_CACHE) cache = {};
  cache.discovered = cache.discovered || [];
  cache.fetched = cache.fetched || {};

  let discovered = cache.discovered;
  let useSitemap = false;
  if (!discovered.length || NO_CACHE) {
    console.log(`\n📡 Discovering URLs from CDX...`);
    discovered = await discoverUrls();
    cache.discovered = discovered;
    if (!NO_CACHE) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log(`  ✓ Discovered ${discovered.length} article URLs`);

    // Fallback: if CDX returned 0 URLs, try sitemap
    if (!discovered.length) {
      console.log(`\n⚠️  CDX returned 0 URLs. Trying sitemap fallback...`);
      discovered = await discoverUrlsFromSitemap();
      if (discovered.length) {
        useSitemap = true;
        cache.discovered = discovered;
        if (!NO_CACHE) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        console.log(`  ✓ Sitemap fallback: ${discovered.length} article URLs`);
      }
    }

    // Fallback 3: if CDX + sitemap both returned 0, try RSS autodiscovery from homepage
    if (!discovered.length) {
      console.log(`\n⚠️  Sitemap also returned 0 URLs. Trying RSS autodiscovery from homepage...`);
      discovered = await discoverUrlsFromRssAutodiscovery();
      if (discovered.length) {
        useSitemap = true; // use live fetcher for RSS-discovered URLs
        cache.discovered = discovered;
        if (!NO_CACHE) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        console.log(`  ✓ RSS autodiscovery: ${discovered.length} article URLs`);
      }
    }
  } else {
    console.log(`\n📡 ${discovered.length} URLs (cached)`);
  }

  if (!discovered.length) {
    console.log("\n⚠️  No URLs discovered. Exiting.");
    return { inserted: 0, skipped: 0 };
  }

  // Choose metadata fetcher based on discovery method
  const metaFetcher = useSitemap ? fetchArticleMetaLive : fetchArticleMeta;
  const metaDelay = useSitemap ? 200 : SNAPSHOT_DELAY_MS;
  if (useSitemap) console.log("  [Sitemap mode] Using live site fetches (no Wayback)");

  console.log(`\n🔍 Fetching metadata for ${discovered.length} articles...`);
  const rows = [];
  let ok = 0;
  let skippedMeta = 0;

  for (let i = 0; i < discovered.length; i++) {
    const article = discovered[i];
    const cacheKey = article.url;

    let meta = cache.fetched[cacheKey];
    if (!meta || NO_CACHE) {
      await sleep_(metaDelay);
      meta = await metaFetcher(article);
      if (meta) {
        cache.fetched[cacheKey] = meta;
        if (!NO_CACHE) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      }
    }

    if (meta && meta.title) {
      rows.push({
        url: article.url,
        title: meta.title,
        description: meta.description || undefined,
        og_image_url: meta.og_image_url || undefined,
        category_id,
        subcategory_id,
        source,
        seeder_score,
      });
      ok++;
    } else { skippedMeta++; }

    if ((i + 1) % 100 === 0 || i === discovered.length - 1) {
      console.log(`  ${i + 1}/${discovered.length} (${ok} ok, ${skippedMeta} skipped)`);
    }
  }

  console.log(`📊 Total articles with metadata: ${rows.length}`);
  if (!rows.length) {
    console.log("\n⚠️  No articles with metadata found. Exiting.");
    return { inserted: 0, skipped: 0 };
  }

  console.log(`\n💾 Submitting to database (checkLive=${!useSitemap}, fetchOg=false)...`);
  const result = await upsertUrls(rows, {
    fetchOg: false,
    checkLive: !useSitemap, // sitemap URLs are live by definition, skip redundant HEAD check
    verbose: true,
  });

  console.log(`\n✅ Done! Inserted: ${result.inserted}, Skipped: ${result.skipped}`);

  // Auto-log run
  const duration = Date.now() - startTime;
  try {
    await logSeedingRun({
      seeder: source,
      displayName,
      source,
      category: category_id,
      subcategory: subcategory_id,
      discovered: discovered.length,
      inserted: result.inserted ?? 0,
      skipped: result.skipped ?? 0,
      dead: result.dead ?? 0,
      duration_ms: duration,
      method: useSitemap ? "sitemap" : "wayback-cdx",
      cache_bytes: (existsSync(CACHE_FILE) ? (readFileSync(CACHE_FILE, "utf8").length) : 0),
    });
  } catch { /* logging is best-effort, never fail the seeder */ }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared RSS + Sitemap + Wayback Multi-Method Seeder
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Multi-method seeder with 3-tier fallback: RSS → Sitemap → Wayback CDX.
 * Each method is tried in sequence; the first to return ≥10 URLs wins.
 * Metadata is fetched from live HTML (or Wayback snapshots for CDX URLs).
 *
 * @param {{
 *   siteDomain: string,
 *   cacheFileName: string,
 *   displayName: string,
 *   feedUrl?: string,
 *   feedXml?: boolean,
 *   sitemapPaths?: string[],
 *   articlePathRegex: RegExp,
 *   skipPaths?: RegExp[],
 *   siteSuffixRegex: RegExp,
 *   category_id: string,
 *   subcategory_id: string,
 *   source: string,
 *   seeder_score?: number,
 *   maxArticles?: number,
 *   maxPages?: number,
 * }} config
 */
export async function seedRssWithFallbacks(config) {
  const {
    siteDomain,
    cacheFileName,
    displayName,
    feedUrl = null,
    feedXml = false,
    sitemapPaths = [
      "/sitemap.xml",
      "/sitemap_index.xml",
      "/wp-sitemap.xml",
      "/sitemap-index.xml",
      "/post-sitemap.xml",
      "/page-sitemap.xml",
    ],
    articlePathRegex,
    skipPaths = [],
    siteSuffixRegex,
    category_id,
    subcategory_id,
    source,
    seeder_score = 0.7,
    maxArticles = 2000,
    maxPages = 20,
  } = config;

  const CACHE_DIR = resolve(__dirname, "../.cache");
  const CACHE_FILE = resolve(CACHE_DIR, cacheFileName);
  mkdirSync(CACHE_DIR, { recursive: true });

  const NO_CACHE = process.argv.includes("--no-cache");
  const UA = "Roam-Seeder/1.0 (+https://roamtheweb.app)";
  const META_DELAY_MS = 300;

  const sleep_ = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── Tier 1: RSS/Atom Feed Discovery ───────────────────────────────────────
  async function discoverUrlsFromRss() {
    if (!feedUrl) return [];
    console.log(`  [RSS] Trying ${feedUrl}...`);

    try {
      const res = await fetchWithRetry(feedUrl, { headers: { "User-Agent": UA } });
      if (!res.ok) { console.log(`  [RSS] HTTP ${res.status}`); return []; }
      const text = await res.text();

      if (text.length < 50) { console.log(`  [RSS] Empty response`); return []; }

      const seenUrls = new Set();
      const results = [];

      // Atom or RSS: extract <entry>/<item> blocks
      const isAtom = /<feed[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(text);
      const entryRe = isAtom ? /<entry[\s\S]*?<\/entry>/gi : /<item[\s\S]*?<\/item>/gi;

      let match;
      while ((match = entryRe.exec(text)) !== null) {
        const block = match[0];

        // Extract <link> — Atom uses <link href="..."/>, RSS uses <link>...</link>
        let link = null;
        const atomLink = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
        const rssLink = block.match(/<link>([^<]+)<\/link>/i);
        link = atomLink?.[1]?.trim() ?? rssLink?.[1]?.trim() ?? null;

        if (!link) continue;

        // Normalize URL
        try {
          const u = new URL(link);
          u.hash = "";
          link = u.toString();
        } catch { continue; }

        let pathname = "";
        try { pathname = new URL(link).pathname; } catch { continue; }
        if (!pathname || pathname === "/") continue;

        // Apply path filters
        const skipStrs = [
          "/tag/", "/author/", "/about", "/search", "/video", "/gallery",
          "/subscribe", "/newsletter", "/account", "/login", "/register",
          "/share", "/store", "/members", "/category/", "/page/", "/feed",
          "/rss", "/atom",
        ];
        if (skipStrs.some((s) => pathname.includes(s))) continue;
        if (skipPaths.some((r) => r.test(pathname))) continue;
        if (!articlePathRegex.test(pathname)) continue;

        if (seenUrls.has(link)) continue;
        seenUrls.add(link);

        // Extract title from feed entry (saves a round-trip)
        let feedTitle = null;
        const atomTitle = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const cdataTitle = block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i);
        feedTitle = cdataTitle?.[1]?.trim() ?? atomTitle?.[1]?.trim() ?? null;
        if (feedTitle) feedTitle = feedTitle.replace(/<[^>]+>/g, "").replace(siteSuffixRegex, "").trim();

        // Extract description from feed
        let feedDesc = null;
        const atomDesc = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
        const cdataDesc = block.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i);
        const rawDesc = cdataDesc?.[1] ?? atomDesc?.[1] ?? null;
        if (rawDesc) {
          feedDesc = rawDesc.replace(/<[^>]+>/g, "").trim().slice(0, 500);
        }

        // Extract published date from feed
        let feedDate = null;
        const atomDate = block.match(/<published[^>]*>([^<]+)<\/published>/i) ??
          block.match(/<updated[^>]*>([^<]+)<\/updated>/i);
        const rssDate = block.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i) ??
          block.match(/<lastBuildDate[^>]*>([^<]+)<\/lastBuildDate>/i);
        feedDate = atomDate?.[1]?.trim() ?? rssDate?.[1]?.trim() ?? null;

        results.push({ url: link, feedTitle, feedDesc, feedDate });

        if (results.length >= maxArticles) break;
      }

      console.log(`  [RSS] Found ${results.length} article URLs`);
      return results;
    } catch (err) {
      console.warn(`  [RSS] Error: ${err.message}`);
      return [];
    }
  }

  // ── Tier 2: Sitemap Discovery (reuses existing pattern) ──────────────────
  async function discoverUrlsFromSitemap() {
    const seenUrls = new Set();
    const results = [];

    async function parseSitemap(sitemapUrl) {
      if (seenUrls.has(sitemapUrl)) return;
      seenUrls.add(sitemapUrl);

      try {
        const res = await fetchWithRetry(sitemapUrl, { headers: { "User-Agent": UA } });
        if (!res.ok) return;
        const text = await res.text();

        if (/<sitemapindex/i.test(text)) {
          const matches = text.matchAll(/<loc>([^<]+)<\/loc>/gi);
          for (const m of matches) {
            const url = m[1].trim();
            if (url.startsWith("http") && !seenUrls.has(url)) {
              await parseSitemap(url);
            }
          }
          return;
        }

        const urlMatches = text.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/gi);
        for (const m of urlMatches) {
          let loc = m[1].trim();
          try {
            const u = new URL(loc);
            u.hash = "";
            loc = u.toString();
          } catch { continue; }

          let pathname = "";
          try { pathname = new URL(loc).pathname; } catch { continue; }
          if (!pathname || pathname === "/") continue;

          const skipStrs = [
            "/tag/", "/author/", "/about", "/search", "/video", "/gallery",
            "/subscribe", "/newsletter", "/account", "/login", "/register",
            "/share", "/store", "/members", "/classifieds", "/bidding",
            "/results", "/shop", "/careers", "/podcast", "/scoreboard",
            "/schedule", "/standings", "/stats", "/watch", "/fantasy",
            "/markets", "/quote", "/category/", "/page/", "/feed",
            "/rss", "/atom",
          ];
          if (skipStrs.some((s) => pathname.includes(s))) continue;
          if (skipPaths.some((r) => r.test(pathname))) continue;
          if (!articlePathRegex.test(pathname)) continue;

          if (seenUrls.has(loc)) continue;
          seenUrls.add(loc);
          results.push({ url: loc, feedTitle: null, feedDesc: null, feedDate: null });

          if (results.length >= maxArticles) return;
        }
      } catch { /* skip unreachable */ }
    }

    for (const path of sitemapPaths) {
      const sitemapUrl = `https://${siteDomain}${path}`;
      console.log(`  [Sitemap] Trying ${sitemapUrl}...`);
      await parseSitemap(sitemapUrl);
      if (results.length > 0) {
        console.log(`  [Sitemap] Found ${results.length} article URLs via ${path}`);
        break;
      }
    }

    return results;
  }

  // ── Tier 3: Wayback CDX Discovery (reuses existing logic) ────────────────
  async function discoverUrlsFromWayback() {
    const CDX_LIMIT = 500;
    const results = [];
    const seenUrls = new Set();

    for (let page = 0; page < maxPages; page++) {
      const cdxUrl =
        `https://web.archive.org/cdx/search/cdx?url=*.${siteDomain}/*&output=json&limit=${CDX_LIMIT}&filter=statuscode:200&collapse=urlkey&fl=timestamp,original`;

      let data = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetchWithRetry(cdxUrl, { headers: { "User-Agent": UA } });
          const text = await res.text();
          if (res.ok && text.startsWith("[")) {
            try { data = JSON.parse(text); } catch { data = null; }
            break;
          }
          if (res.status === 429 || res.status >= 500) {
            await sleep_(2000 * (attempt + 1));
            continue;
          }
          break;
        } catch {
          if (attempt < 2) await sleep_(2000 * (attempt + 1));
        }
      }

      if (!data || data.length <= 1) break;

      for (let i = 1; i < data.length; i++) {
        const [timestamp, originalUrl] = data[i];
        let pathname = "";
        try { pathname = new URL(originalUrl).pathname; } catch { continue; }
        if (!pathname || pathname === "/") continue;

        const skipStrs = [
          "/tag/", "/author/", "/about", "/search", "/video", "/gallery",
          "/subscribe", "/newsletter", "/account", "/login", "/register",
          "/share", "/store", "/members", "/classifieds", "/bidding",
          "/results", "/shop", "/careers", "/podcast", "/scoreboard",
          "/schedule", "/standings", "/stats", "/watch", "/fantasy",
          "/markets", "/quote",
        ];
        if (skipStrs.some((s) => pathname.includes(s))) continue;
        if (skipPaths.some((r) => r.test(pathname))) continue;
        if (!articlePathRegex.test(pathname)) continue;

        let url = originalUrl.replace(/^http:\/\//, "https://");
        try {
          const u = new URL(url);
          u.hash = "";
          url = u.toString();
        } catch { /* keep original */ }

        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        results.push({ url, timestamp });
      }

      console.log(`  [Wayback] Page ${page + 1}/${maxPages}: ${results.length} URLs so far`);

      if (data.length < CDX_LIMIT + 1) break;
      await sleep_(600);
    }

    return results;
  }

  // ── Fetch metadata from live HTML ────────────────────────────────────────
  async function fetchArticleMeta(url, feedTitle) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);

      const res = await fetchWithRetry(url, {
        headers: { "User-Agent": UA },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        // If we have a feed title, return it even on HTTP errors
        return feedTitle ? { title: feedTitle, description: null, og_image_url: null } : null;
      }
      const contentLen = parseInt(res.headers.get("content-length") || "0");
      if (contentLen > 2_000_000) { clearTimeout(timer); return feedTitle ? { title: feedTitle, description: null, og_image_url: null } : null; }

      const html = await res.text();
      clearTimeout(timer);

      // Title — prefer <title> tag, fall back to feed title
      let title = null;
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim().replace(siteSuffixRegex, "").trim();
      }
      if (!title) {
        const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
        if (ogTitle) title = ogTitle[1].trim().replace(siteSuffixRegex, "").trim();
        else if (feedTitle) title = feedTitle;
        else {
          const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
          if (h1) title = h1[1].trim();
        }
      }

      // Description
      let description = null;
      const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
      const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      const rawDesc = ogDesc?.[1]?.trim() ?? metaDesc?.[1]?.trim() ?? null;
      if (rawDesc) description = rawDesc.slice(0, 500);

      // OG Image
      let og_image_url = null;
      const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      if (ogImg) og_image_url = ogImg[1].trim();
      if (!og_image_url) {
        const twImg = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
        if (twImg) og_image_url = twImg[1].trim();
      }

      return { title, description, og_image_url };
    } catch {
      return feedTitle ? { title: feedTitle, description: null, og_image_url: null } : null;
    }
  }

  // ── RSS Autodiscovery (4th fallback) ───────────────────────────────────
  async function discoverUrlsFromRssAutodiscovery() {
    console.log(`  [RSS-Auto] Scanning homepage...`);
    const entries = await _discoverRssAuto({ siteDomain, articlePathRegex, skipPaths, siteSuffixRegex, UA, maxArticles: 2000 });
    console.log(`  [RSS-Auto] Extracted ${entries.length} article URLs from feeds`);
    return entries.map(e => ({ url: e.url }));
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  const startTime = Date.now();
  console.log(`${displayName} Seeder (Multi-Method: RSS → Sitemap → Wayback → RSS Auto)\n`);

  let cache = {};
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
      console.log(`📦 Loaded cache: ${(cache.discovered || []).length} URLs discovered, ${Object.keys(cache.fetched || {}).length} fetched`);
    } catch { cache = {}; }
  }
  if (NO_CACHE) cache = {};
  cache.discovered = cache.discovered || [];
  cache.fetched = cache.fetched || {};

  let discovered = cache.discovered;
  let method = "cached";

  if (!discovered.length || NO_CACHE) {
    // Tier 1: RSS
    console.log(`\n📡 Tier 1: Discovering URLs from RSS feed...`);
    discovered = await discoverUrlsFromRss();
    if (discovered.length >= 10) {
      method = "RSS";
      console.log(`  ✓ RSS: ${discovered.length} article URLs`);
    } else {
      // Tier 2: Sitemap
      console.log(`\n📡 Tier 2: Falling back to sitemap discovery...`);
      discovered = await discoverUrlsFromSitemap();
      if (discovered.length >= 10) {
        method = "sitemap";
        console.log(`  ✓ Sitemap: ${discovered.length} article URLs`);
      } else {
        // Tier 3: Wayback CDX
        console.log(`\n📡 Tier 3: Falling back to Wayback CDX...`);
        const wbResults = await discoverUrlsFromWayback();
        // Normalize Wayback results to match the feed/sitemap entry shape
        discovered = wbResults.map(r => ({ url: r.url, feedTitle: null, feedDesc: null, feedDate: null, timestamp: r.timestamp }));
        if (discovered.length > 0) {
          method = "Wayback";
          console.log(`  ✓ Wayback: ${discovered.length} article URLs`);
        } else {
          // Tier 4: RSS autodiscovery from homepage (no feedUrl supplied, or all prior tiers failed)
          console.log(`\n📡 Tier 4: Falling back to RSS autodiscovery from homepage...`);
          const rssAutoResults = await discoverUrlsFromRssAutodiscovery();
          discovered = rssAutoResults.map(r => ({ url: r.url, feedTitle: null, feedDesc: null, feedDate: null, timestamp: null }));
          if (discovered.length > 0) {
            method = "RSS-autodiscovery";
            console.log(`  ✓ RSS autodiscovery: ${discovered.length} article URLs`);
          }
        }
      }
    }

    cache.discovered = discovered;
    if (!NO_CACHE) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } else {
    console.log(`\n📡 ${discovered.length} URLs (cached)`);
  }

  if (!discovered.length) {
    console.log("\n⚠️  No URLs discovered. Exiting.");
    return { inserted: 0, skipped: 0 };
  }

  const isWayback = method === "Wayback";

  console.log(`\n🔍 [${method}] Fetching metadata for ${discovered.length} articles...`);
  const rows = [];
  let ok = 0;
  let skippedMeta = 0;

  for (let i = 0; i < discovered.length; i++) {
    const entry = discovered[i];
    const cacheKey = entry.url;

    let meta = cache.fetched[cacheKey];
    if (!meta || NO_CACHE) {
      await sleep_(META_DELAY_MS);

      if (isWayback && entry.timestamp) {
        // Wayback metadata fetch
        const wbUrl = `https://web.archive.org/web/${entry.timestamp}/${entry.url}`;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12000);
          const res = await fetchWithRetry(wbUrl, { headers: { "User-Agent": UA }, signal: controller.signal });
          clearTimeout(timer);
          if (res.ok) {
            const html = await res.text();

            let title = null;
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) title = titleMatch[1].trim().replace(siteSuffixRegex, "").trim();
            if (!title) {
              const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
              if (ogTitle) title = ogTitle[1].trim().replace(siteSuffixRegex, "").trim();
              else {
                const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
                if (h1) title = h1[1].trim();
              }
            }

            let description = null;
            const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
            const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
            const rawDesc = ogDesc?.[1]?.trim() ?? metaDesc?.[1]?.trim() ?? null;
            if (rawDesc) description = rawDesc.slice(0, 500);

            let og_image_url = null;
            const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
            if (ogImg) og_image_url = ogImg[1].trim();
            if (!og_image_url) {
              const twImg = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
              if (twImg) og_image_url = twImg[1].trim();
            }

            meta = { title, description, og_image_url };
          } else {
            meta = entry.feedTitle ? { title: entry.feedTitle, description: entry.feedDesc, og_image_url: null } : null;
          }
        } catch {
          meta = entry.feedTitle ? { title: entry.feedTitle, description: entry.feedDesc, og_image_url: null } : null;
        }
      } else {
        // Live HTML fetch
        meta = await fetchArticleMeta(entry.url, entry.feedTitle);
      }

      if (meta) {
        // Merge in feed description if HTML didn't provide one
        if (!meta.description && entry.feedDesc) meta.description = entry.feedDesc;
        cache.fetched[cacheKey] = meta;
        if (!NO_CACHE) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      }
    }

    if (meta && meta.title) {
      rows.push({
        url: entry.url,
        title: meta.title,
        description: meta.description || undefined,
        og_image_url: meta.og_image_url || undefined,
        category_id,
        subcategory_id,
        source,
        seeder_score,
      });
      ok++;
    } else { skippedMeta++; }

    if ((i + 1) % 50 === 0 || i === discovered.length - 1) {
      console.log(`  ${i + 1}/${discovered.length} (${ok} ok, ${skippedMeta} skipped)`);
    }
  }

  console.log(`📊 Total articles with metadata: ${rows.length}`);
  if (!rows.length) {
    console.log("\n⚠️  No articles with metadata found. Exiting.");
    return { inserted: 0, skipped: 0 };
  }

  console.log(`\n💾 Submitting to database (checkLive=${!isWayback}, fetchOg=false)...`);
  const result = await upsertUrls(rows, {
    fetchOg: false,
    checkLive: !isWayback,
    verbose: true,
  });

  console.log(`\n✅ Done! Inserted: ${result.inserted}, Skipped: ${result.skipped}`);

  // Auto-log run
  const duration = Date.now() - startTime;
  try {
    await logSeedingRun({
      seeder: source,
      displayName,
      source,
      category: category_id,
      subcategory: subcategory_id,
      discovered: discovered.length,
      inserted: result.inserted ?? 0,
      skipped: result.skipped ?? 0,
      dead: result.dead ?? 0,
      duration_ms: duration,
      method,
      cache_bytes: existsSync(CACHE_FILE) ? readFileSync(CACHE_FILE, 'utf8').length : 0,
    });
  } catch { /* best-effort */ }

  return result;
}
