/**
 * seed-ted.js — TED Talks seeder
 *
 * Enumerates all TED talk URLs from the official sitemap, then fetches
 * title, description, and thumbnail from each talk page's OG/JSON-LD metadata.
 * Maps talks to Roam categories based on keywords in the title and URL slug.
 *
 * No API key required. TED talk content is freely accessible.
 * Non-commercial use only — all rows tagged source = 'ted'.
 *
 * Run from repo root:
 *   node scripts/seed-ted.js
 *   node scripts/seed-ted.js --no-cache   # re-fetch sitemap + talk metadata
 *   node scripts/seed-ted.js --reset      # clear checkpoint and start over
 */

import fetch from 'node-fetch';
import zlib from 'zlib';
import { promisify } from 'util';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const gunzip = promisify(zlib.gunzip);

const __dirname       = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR       = resolve(__dirname, '.cache');
const CACHE_FILE      = resolve(CACHE_DIR, 'ted.json');
const PROGRESS_FILE   = resolve(CACHE_DIR, 'ted-progress.json');
const NO_CACHE        = process.argv.includes('--no-cache');
const RESET           = process.argv.includes('--reset');

const SITEMAP_INDEX   = 'https://www.ted.com/sitemap.xml';
const DELAY_MS        = 1500; // ~40 req/min — polite crawl rate
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(CACHE_DIR, { recursive: true });

// ── Category mapping ──────────────────────────────────────────────────────────
// Keywords matched against the URL slug (lower-case). First match wins.
const KEYWORD_MAP = [
  // SCIENCE
  { words: ['science','scientist','biology','evolution','genetics','dna','chemistry',
            'physics','astronomy','space','climate','environment','nature','ocean',
            'animal','bird','plant','bacteria','virus','vaccine','neuroscience',
            'brain','math','mathematics','quantum','ecology','geology','fossil'],
    cat: CATEGORY.SCIENCE },
  // TECHNOLOGY
  { words: ['technology','tech','computer','software','internet','ai','robot',
            'algorithm','data','cybersecurity','hack','code','design','engineering',
            'machine_learning','artificial_intelligence','innovation','startup',
            'digital','web','app','network','privacy','surveillance'],
    cat: CATEGORY.TECHNOLOGY },
  // MIND & BODY
  { words: ['health','medicine','medical','doctor','mental','depression','anxiety',
            'happiness','psychology','therapy','trauma','stress','sleep','nutrition',
            'food','diet','exercise','fitness','wellbeing','death','dying','grief',
            'addiction','drug','pain','disability','autism','adhd'],
    cat: CATEGORY.MIND_BODY },
  // HISTORY & IDEAS
  { words: ['history','philosophy','politics','government','democracy','war','peace',
            'economics','economy','justice','law','religion','society','culture',
            'social','power','leadership','inequality','poverty','race','gender',
            'feminism','education','future','idea','ethics','moral','human_rights'],
    cat: CATEGORY.HISTORY_IDEAS },
  // ARTS & CULTURE
  { words: ['art','artist','music','musician','dance','dancer','film','cinema','movie',
            'theater','theatre','literature','writer','book','poetry','poet','creative',
            'creativity','photography','architecture','fashion','sculpture','painting',
            'comedy','humor','storytelling','story'],
    cat: CATEGORY.ARTS_CULTURE },
  // PEOPLE & PLACES
  { words: ['travel','city','urban','community','africa','asia','europe','latin',
            'refugee','immigration','global','world','culture','place','country',
            'nation','geography','language','identity','diversity'],
    cat: CATEGORY.PEOPLE_PLACES },
  // GAMES & HOBBIES
  { words: ['game','sport','play','athlete','olympic','adventure','exploration',
            'hobby','chess','puzzle','competition'],
    cat: CATEGORY.GAMES_HOBBIES },
  // WEIRD & WONDERFUL (catch-all for surprising/niche talks)
  { words: ['weird','wonder','mystery','magic','strange','surprise','unexpected',
            'illusion','phenomenon','curiosity'],
    cat: CATEGORY.WEIRD_WONDERFUL },
];

function categoryFromSlug(slug) {
  const lower = slug.toLowerCase().replace(/-/g, '_');
  for (const { words, cat } of KEYWORD_MAP) {
    if (words.some((w) => lower.includes(w))) return cat;
  }
  // Default: History & Ideas — TED's core is ideas/society
  return CATEGORY.HISTORY_IDEAS;
}

// ── Fetch and decompress a .xml.gz sitemap ────────────────────────────────────
async function fetchSitemapGz(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const buf = await res.buffer();
  // Attempt gunzip; if it fails, treat as plain text XML
  try {
    return (await gunzip(buf)).toString('utf8');
  } catch {
    return buf.toString('utf8');
  }
}

// ── Find the talks sitemap URL from the index ─────────────────────────────────
async function findTalksSitemap() {
  const xml = await fetchSitemapGz(SITEMAP_INDEX);
  const match = xml.match(/<loc>(https?:\/\/[^<]+talks[^<]*)<\/loc>/i);
  if (match) return match[1].trim();
  // Fallback: known location
  return 'https://www.ted.com/sitemaps/talks.xml.gz';
}

// ── Parse <loc> entries from a sitemap XML string ─────────────────────────────
function parseLocUrls(xml) {
  const urls = [];
  const re = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    urls.push(m[1].trim());
  }
  return urls;
}

// ── Extract metadata from a TED talk page ────────────────────────────────────
async function fetchTalkMeta(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
    });
    if (!res.ok) { clearTimeout(timer); return null; }
    const html = await res.text();
    clearTimeout(timer);

    // Try JSON-LD first (TED embeds VideoObject structured data)
    const jsonldMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (jsonldMatch) {
      try {
        const data = JSON.parse(jsonldMatch[1]);
        const objs = Array.isArray(data) ? data : [data];
        for (const obj of objs) {
          if (obj['@type'] === 'VideoObject' || obj.name) {
            return {
              title:       obj.name?.slice(0, 255) ?? null,
              description: obj.description?.slice(0, 500) ?? null,
              ogImage:     obj.thumbnailUrl ?? obj.thumbnail?.url ?? null,
            };
          }
        }
      } catch { /* fall through to OG */ }
    }

    // OG fallback
    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    const descMatch  = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    const imgMatch   = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    return {
      title:       titleMatch?.[1]?.trim().slice(0, 255) ?? null,
      description: descMatch?.[1]?.trim().slice(0, 500)  ?? null,
      ogImage:     imgMatch?.[1]?.trim()                 ?? null,
    };
  } catch {
    return null;
  }
}

// ── Load / save progress ──────────────────────────────────────────────────────
function loadProgress() {
  if (RESET || !existsSync(PROGRESS_FILE)) {
    return { phase: 'fetch', doneIndex: 0, rows: [] };
  }
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return { phase: 'fetch', doneIndex: 0, rows: [] };
  }
}

function saveProgress(p) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(p));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n========== TED Talks Seeder ==========\n');

  // ── Phase 1: collect talk URLs from sitemap ──
  let talkUrls;
  if (!NO_CACHE && !RESET && existsSync(CACHE_FILE)) {
    console.log('[ted] Loading cached talk list...');
    talkUrls = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[ted] ${talkUrls.length} talks from cache`);
  } else {
    console.log('[ted] Fetching talks sitemap...');
    let sitemapUrl;
    try {
      sitemapUrl = await findTalksSitemap();
      console.log(`[ted] Found sitemap: ${sitemapUrl}`);
    } catch (err) {
      console.error(`[ted] Could not load sitemap index: ${err.message}`);
      process.exit(1);
    }

    let sitemapXml;
    try {
      sitemapXml = await fetchSitemapGz(sitemapUrl);
    } catch (err) {
      // Try uncompressed fallback
      console.warn(`[ted] .gz failed (${err.message}), trying .xml...`);
      const fallback = sitemapUrl.replace('.xml.gz', '.xml');
      const res = await fetch(fallback, {
        headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
      });
      if (!res.ok) { console.error(`[ted] Sitemap fetch failed: HTTP ${res.status}`); process.exit(1); }
      sitemapXml = await res.text();
    }

    talkUrls = parseLocUrls(sitemapXml)
      .filter((u) => u.includes('/talks/') && !u.endsWith('/talks'));
    console.log(`[ted] Found ${talkUrls.length} talk URLs`);
    writeFileSync(CACHE_FILE, JSON.stringify(talkUrls));
  }

  if (talkUrls.length === 0) {
    console.error('[ted] No talk URLs found. Exiting.');
    process.exit(1);
  }

  // ── Phase 2: fetch metadata for each talk ──
  const progress = loadProgress();
  const rows = progress.rows ?? [];
  let start = progress.doneIndex ?? 0;

  if (start > 0) {
    console.log(`[ted] Resuming from talk ${start + 1} / ${talkUrls.length} (${rows.length} already fetched)`);
  } else {
    console.log(`[ted] Fetching metadata for ${talkUrls.length} talks...`);
  }

  for (let i = start; i < talkUrls.length; i++) {
    const url  = talkUrls[i];
    // Extract slug from URL for keyword matching
    const slug = url.split('/talks/')[1]?.split('?')[0] ?? '';

    const meta = await fetchTalkMeta(url);
    if (meta && (meta.title || meta.description)) {
      rows.push({
        url,
        title:        meta.title,
        description:  meta.description,
        og_image_url: meta.ogImage ?? undefined,
        category_id:  categoryFromSlug(slug),
        source:       'ted',
      });
    }

    if ((i + 1) % 25 === 0) {
      console.log(`[ted] ${i + 1} / ${talkUrls.length} fetched (${rows.length} valid)`);
      saveProgress({ phase: 'fetch', doneIndex: i + 1, rows });
    }

    await sleep(DELAY_MS);
  }

  saveProgress({ phase: 'upsert', doneIndex: talkUrls.length, rows });
  console.log(`\n[ted] Metadata fetch complete: ${rows.length} talks ready for upsert`);

  // ── Phase 3: upsert ──
  console.log('[ted] Upserting to Supabase...');
  const result = await upsertUrls(rows, { fetchOg: false, verbose: false });
  console.log(`\n[ted] Done — ${result.inserted} inserted, ${result.skipped} skipped`);

  // Clear progress on success
  writeFileSync(PROGRESS_FILE, JSON.stringify({ phase: 'complete', total: rows.length }));
}

main().catch((err) => {
  console.error('[ted] Fatal:', err.message);
  process.exit(1);
});
