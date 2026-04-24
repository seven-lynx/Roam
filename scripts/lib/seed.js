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

// ── Tracking / noise query params to strip ───────────────────────────────────
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_reader', 'utm_name', 'utm_brand',
  'fbclid', 'gclid', 'msclkid', 'dclid', 'zanpid', 'igshid',
  'mc_cid', 'mc_eid', 'ref', 'referrer', '_ga', 'twclid',
  'yclid', 's_cid', 'ncid', 'nr_email_referer',
]);

// ── URL normalisation ─────────────────────────────────────────────────────────
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
    clearTimeout(timer);

    if (!res.ok) return null;
    const html = await res.text();

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

// ── Main export: upsert a batch of URL records ────────────────────────────────
const BATCH_SIZE = 50;

/**
 * @param {Array<{
 *   url: string,
 *   title?: string,
 *   description?: string,
 *   category_id?: string,
 *   subcategory_id?: string,
 *   source?: string,
 *   og_image_url?: string,
 * }>} rows
 * @param {{ fetchOg?: boolean, verbose?: boolean }} opts
 */
export async function upsertUrls(rows, { fetchOg = true, verbose = true } = {}) {
  const log = verbose ? console.log : () => {};

  // 1. Normalise URLs and drop anything unparseable
  const normalised = rows
    .map((r) => ({ ...r, url: normaliseUrl(r.url) }))
    .filter((r) => r.url !== null);

  if (normalised.length < rows.length) {
    log(`[seed] Dropped ${rows.length - normalised.length} unparseable URLs`);
  }

  // 2. Check which normalised URLs are already in the DB
  const urls = normalised.map((r) => r.url);
  const { data: existing } = await supabase
    .from('urls')
    .select('url')
    .in('url', urls);

  const existingSet = new Set((existing ?? []).map((r) => r.url));
  const fresh = normalised.filter((r) => !existingSet.has(r.url));

  log(`[seed] ${fresh.length} new / ${existingSet.size} already exist (${normalised.length} total)`);
  if (fresh.length === 0) return { inserted: 0, skipped: existingSet.size };

  // 3. Fetch og:image for rows that don't have one
  if (fetchOg) {
    log(`[seed] Fetching og:image for ${fresh.length} URLs...`);
    for (let i = 0; i < fresh.length; i++) {
      const row = fresh[i];
      if (!row.og_image_url) {
        row.og_image_url = await fetchOgImage(row.url);
      }
      if (verbose && (i + 1) % 10 === 0) {
        log(`[seed]   ${i + 1}/${fresh.length} done`);
      }
    }
  }

  // 4. Batch upsert
  let inserted = 0;
  for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
    const batch = fresh.slice(i, i + BATCH_SIZE).map((r) => ({
      url:            r.url,
      title:          r.title        ?? null,
      description:    r.description  ?? null,
      og_image_url:   r.og_image_url ?? null,
      category_id:    r.category_id  ?? null,
      subcategory_id: r.subcategory_id ?? null,
      source:         r.source       ?? 'manual',
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
  TECHNOLOGY:      'c10000000000000000000000000000001',
  SCIENCE:         'c10000000000000000000000000000002',
  ARTS_CULTURE:    'c10000000000000000000000000000003',
  ENTERTAINMENT:   'c10000000000000000000000000000004',
  SPORTS_OUTDOORS: 'c10000000000000000000000000000005',
  FOOD_DRINK:      'c10000000000000000000000000000006',
  TRAVEL:          'c10000000000000000000000000000007',
  HEALTH_WELLNESS: 'c10000000000000000000000000000008',
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
