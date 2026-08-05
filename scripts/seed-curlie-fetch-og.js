/**
 * seed-curlie-fetch-og.js — Fetch missing OG images for Curlie URLs
 *
 * This runs as a separate background task after initial Curlie import.
 * Fetches og:image for all Curlie URLs that don't have one yet.
 * Can be run overnight, can be interrupted and resumed without issues.
 *
 * Features:
 *   - Persistent progress tracking (resumes from where it left off)
 *   - Batch updates (50 URLs at a time to keep memory low)
 *   - Rate limiting (1-second delays between fetches to avoid hammering sites)
 *   - Graceful error handling
 *
 * Run from repo root:
 *   node scripts/seed-curlie-fetch-og.js
 *   node scripts/seed-curlie-fetch-og.js --reset  # start over from beginning
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const PROGRESS_FILE = resolve(__dirname, '.cache', 'curlie-og-progress.json');
const BATCH_SIZE = 50;
const FETCH_TIMEOUT_MS = 8000;
const DELAY_BETWEEN_FETCHES_MS = 500; // Respectful rate limiting
const RESET = process.argv.includes('--reset');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Progress tracking ────────────────────────────────────────────────────────

function loadProgress() {
  if (RESET) {
    console.log('[og] --reset flag: starting from beginning');
    return { processedCount: 0, lastUrl: null, lastError: null };
  }

  if (!existsSync(PROGRESS_FILE)) {
    return { processedCount: 0, lastUrl: null, lastError: null };
  }

  try {
    const data = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    console.log(`[og] Resuming from: ${data.processedCount} URLs processed`);
    if (data.lastError) {
      console.log(`[og] Last error: ${data.lastError}`);
    }
    return data;
  } catch {
    return { processedCount: 0, lastUrl: null, lastError: null };
  }
}

function saveProgress(processedCount, lastUrl, lastError = null) {
  const dir = dirname(PROGRESS_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const data = {
    processedCount,
    lastUrl,
    lastError,
    timestamp: new Date().toISOString(),
  };

  writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

// ── OG image fetching ────────────────────────────────────────────────────────

async function fetchOgImage(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
      redirect: 'follow',
    });

    if (!res.ok) {
      clearTimeout(timer);
      return null;
    }

    const contentLen = parseInt(res.headers.get('content-length') || '0');
    if (contentLen > 2_000_000) {
      clearTimeout(timer);
      return null;
    }

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

// ── Main seeder ──────────────────────────────────────────────────────────────

async function seedCurlieOg() {
  console.log('\n========== Curlie OG Image Fetcher ==========\n');

  const progress = loadProgress();
  let processedCount = progress.processedCount;
  let successCount = 0;
  let errorCount = 0;

  // 1. Fetch all Curlie URLs with missing OG images
  console.log('[og] Querying Curlie URLs without og_image_url...');
  const { data: urls, error: queryError } = await supabase
    .from('urls')
    .select('id, url')
    .eq('source', 'curlie')
    .is('og_image_url', null)
    .order('created_at', { ascending: true })
    .limit(100000); // Fetch up to 100K at a time (can run multiple times)

  if (queryError) {
    console.error('[og] Query error:', queryError.message);
    process.exit(1);
  }

  if (!urls || urls.length === 0) {
    console.log('[og] All Curlie URLs already have og_image_url! ✨');
    console.log('[og] Done.');
    process.exit(0);
  }

  console.log(`[og] Found ${urls.length} URLs needing og_image_url`);
  console.log(`[og] Already processed: ${processedCount}, resuming...\n`);

  // 2. Process URLs in batches
  const urlsToUpdate = []; // Accumulate OG data to update

  for (let i = 0; i < urls.length; i++) {
    const urlRecord = urls[i];

    // Fetch OG image
    const ogImage = await fetchOgImage(urlRecord.url);
    if (ogImage) {
      successCount++;
      urlsToUpdate.push({ id: urlRecord.id, og_image_url: ogImage });
    } else {
      errorCount++;
    }

    processedCount++;

    // Batch update and reset accumulator every BATCH_SIZE URLs
    if ((i + 1) % BATCH_SIZE === 0 || i === urls.length - 1) {
      if (urlsToUpdate.length > 0) {
        console.log(`[og] ${processedCount} processed (${successCount} with images, ${errorCount} failed)`);

        const { error: updateError } = await supabase
          .from('urls')
          .upsert(urlsToUpdate, { onConflict: 'id' });

        if (updateError) {
          console.error(`[og] Update error on batch: ${updateError.message}`);
          saveProgress(processedCount, urlRecord.url, updateError.message);
        } else {
          console.log(`[og]   Batch updated: ${urlsToUpdate.length} rows with og_image_url`);
        }

        urlsToUpdate.length = 0; // Reset accumulator
      }

      // Save progress every batch
      saveProgress(processedCount, urlRecord.url);
    }

    // Rate limiting between fetches
    await sleep(DELAY_BETWEEN_FETCHES_MS);
  }

  // Final save
  saveProgress(processedCount, urls[urls.length - 1].url);

  console.log(`\n[og] Complete!`);
  console.log(`     Total processed: ${processedCount}`);
  console.log(`     With images:     ${successCount}`);
  console.log(`     Failed/missing:  ${errorCount}\n`);
}

// ── Run ──────────────────────────────────────────────────────────────────────

seedCurlieOg().catch((err) => {
  console.error('[og] Fatal error:', err.message);
  console.error(err);
  process.exit(1);
});
