/**
 * seed-flickr-commons.mjs — Flickr: The Commons seeder
 *
 * Collects public-domain photographs from cultural institutions participating
 * in "Flickr: The Commons" (https://www.flickr.com/commons). These institutions
 * — national libraries, museums, archives — have uploaded millions of
 * digitised photographs under the "no known copyright restrictions" licence.
 *
 * Each seeded URL is a Flickr photo page (not a raw image), giving users full
 * context: title, description, date, tags, and licence.
 *
 * No API key required — uses Flickr's public RSS feeds.
 * Add institutions to INSTITUTIONS below; NSIDs come from each account's URL.
 *
 * Run from repo root:
 *   node scripts/seed-flickr-commons.mjs
 *   node scripts/seed-flickr-commons.mjs --no-cache
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY, SUBCATEGORY, fetchWithRetry } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'flickr-commons.json');
const NO_CACHE   = process.argv.includes('--no-cache');

// Polite delay between RSS fetches — Flickr allows scraping but keep it gentle
const DELAY_MS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Flickr Commons institutions ───────────────────────────────────────────────
// To add more: find the institution's NSID from their Flickr URL
// (e.g. https://www.flickr.com/people/library_of_congress/ → view source → "nsid" field)
// or from https://www.flickr.com/commons/institutions/
const INSTITUTIONS = [
  // ── National Libraries & Archives ─────────────────────────────────────────
  {
    nsid:        '8623220@N02',
    name:        'Library of Congress',
    categoryId:  CATEGORY.HISTORY_IDEAS,
    subcatId:    SUBCATEGORY.MODERN_HISTORY,
  },
  {
    nsid:        '35740357@N03',
    name:        'US National Archives',
    categoryId:  CATEGORY.HISTORY_IDEAS,
    subcatId:    SUBCATEGORY.MODERN_HISTORY,
  },
  {
    nsid:        '12403504@N02',
    name:        'British Library',
    categoryId:  CATEGORY.HISTORY_IDEAS,
    subcatId:    SUBCATEGORY.ANCIENT_MEDIEVAL_HISTORY,
  },
  {
    nsid:        '34101206@N08',
    name:        'National Library of Australia',
    categoryId:  CATEGORY.HISTORY_IDEAS,
    subcatId:    SUBCATEGORY.MODERN_HISTORY,
  },
  {
    nsid:        '9196820@N00',
    name:        'State Library Victoria',
    categoryId:  CATEGORY.HISTORY_IDEAS,
    subcatId:    SUBCATEGORY.SOCIAL_HISTORY,
  },
  {
    nsid:        '29454428@N08',
    name:        'State Library of NSW',
    categoryId:  CATEGORY.HISTORY_IDEAS,
    subcatId:    SUBCATEGORY.SOCIAL_HISTORY,
  },

  // ── Art Museums ───────────────────────────────────────────────────────────
  {
    nsid:        '40829490@N04',
    name:        'Rijksmuseum',
    categoryId:  CATEGORY.ARTS_CULTURE,
    subcatId:    SUBCATEGORY.VISUAL_ART,
  },
  {
    nsid:        '35436291@N05',
    name:        'National Gallery of Art',
    categoryId:  CATEGORY.ARTS_CULTURE,
    subcatId:    SUBCATEGORY.VISUAL_ART,
  },
  {
    nsid:        '26152503@N04',
    name:        'National Galleries of Scotland',
    categoryId:  CATEGORY.ARTS_CULTURE,
    subcatId:    SUBCATEGORY.VISUAL_ART,
  },
  {
    nsid:        '24785917@N03',
    name:        'Museum of Applied Arts & Sciences',
    categoryId:  CATEGORY.ARTS_CULTURE,
    subcatId:    SUBCATEGORY.VISUAL_ART,
  },

  // ── Natural History & Science ─────────────────────────────────────────────
  {
    nsid:        '35127462@N08',
    name:        'NASA on The Commons',
    categoryId:  CATEGORY.SCIENCE,
    subcatId:    SUBCATEGORY.SPACE_ASTRONOMY,
  },
  {
    nsid:        '25053835@N03',
    name:        'Smithsonian Institution',
    categoryId:  CATEGORY.SCIENCE,
    subcatId:    SUBCATEGORY.PALEONTOLOGY_NATURAL_HISTORY,
  },
  {
    nsid:        '31575009@N05',
    name:        'Wellcome Collection',
    categoryId:  CATEGORY.SCIENCE,
    subcatId:    SUBCATEGORY.MEDICINE_HEALTH_SCIENCE,
  },
  {
    nsid:        '9422878@N06',
    name:        'Science Museum Group',
    categoryId:  CATEGORY.SCIENCE,
    subcatId:    SUBCATEGORY.MEDICINE_HEALTH_SCIENCE,
  },

  // ── Photography Museums ───────────────────────────────────────────────────
  {
    nsid:        '7424879@N04',
    name:        'George Eastman Museum',
    categoryId:  CATEGORY.ARTS_CULTURE,
    subcatId:    SUBCATEGORY.PHOTOGRAPHY,
  },
  {
    nsid:        '47103991@N07',
    name:        'Museum of Photographic Arts',
    categoryId:  CATEGORY.ARTS_CULTURE,
    subcatId:    SUBCATEGORY.PHOTOGRAPHY,
  },

  // ── Military & Maritime History ────────────────────────────────────────────
  {
    nsid:        '70568523@N05',
    name:        'Imperial War Museum',
    categoryId:  CATEGORY.HISTORY_IDEAS,
    subcatId:    SUBCATEGORY.MILITARY_HISTORY,
  },
  {
    nsid:        '11474655@N00',
    name:        'National Maritime Museum',
    categoryId:  CATEGORY.HISTORY_IDEAS,
    subcatId:    SUBCATEGORY.SOCIAL_HISTORY,
  },
  {
    nsid:        '49487266@N07',
    name:        'San Diego Air & Space Museum',
    categoryId:  CATEGORY.SCIENCE,
    subcatId:    SUBCATEGORY.SPACE_ASTRONOMY,
  },

  // ── Social & Labour History ───────────────────────────────────────────────
  {
    nsid:        '27116820@N05',
    name:        'Kheel Center (Cornell)',
    categoryId:  CATEGORY.HISTORY_IDEAS,
    subcatId:    SUBCATEGORY.SOCIAL_HISTORY,
  },
  {
    nsid:        '75785096@N00',
    name:        'Prelinger Archives',
    categoryId:  CATEGORY.HISTORY_IDEAS,
    subcatId:    SUBCATEGORY.MODERN_HISTORY,
  },

  // ── City & Regional Collections ────────────────────────────────────────────
  {
    nsid:        '58558794@N07',
    name:        'New York Public Library',
    categoryId:  CATEGORY.PEOPLE_PLACES,
    subcatId:    SUBCATEGORY.CITIES_URBAN_LIFE,
  },
  {
    nsid:        '55877901@N06',
    name:        'Penn Museum',
    categoryId:  CATEGORY.HISTORY_IDEAS,
    subcatId:    SUBCATEGORY.ANTHROPOLOGY_ARCHAEOLOGY,
  },
];

// ── Build RSS URL for a given institution NSID ────────────────────────────────
function rssUrl(nsid) {
  return `https://www.flickr.com/services/feeds/photos_public.gne?id=${encodeURIComponent(nsid)}&format=rss2`;
}

// ── Parse Flickr RSS feed ─────────────────────────────────────────────────────
function parseFeed(xml) {
  const items = [];
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];

    // <link> is followed by a CDATA comment in Flickr RSS — match the URL before it
    const linkMatch  = block.match(/<link[^>]*>(?:<!--)?\s*(https?:\/\/[^\s<]+)\s*(?:-->)?<\/link>/i)
      ?? block.match(/<link[^>]+href="([^"]+)"/i);
    const titleMatch = block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)
      ?? block.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch  = block.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)
      ?? block.match(/<description[^>]*>([^<]*)<\/description>/i);
    // Flickr provides the image URL as <media:content url="..." />
    const imgMatch   = block.match(/<media:content[^>]+url="([^"]+)"/i)
      ?? block.match(/<enclosure[^>]+url="([^"]+)"/i);
    const pubDateMatch = block.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i)
      ?? block.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/i);

    const url = linkMatch?.[1]?.trim();
    // Only keep photo page URLs — not raw image files or other paths
    if (!url || !url.includes('flickr.com/photos/')) continue;

    const title = titleMatch
      ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').trim()
      : null;
    if (!title) continue;

    // Extract description text and the og:image from description HTML
    const rawDesc = descMatch?.[1] ?? null;
    const description = rawDesc
      ? rawDesc.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ').trim().slice(0, 500)
      : null;

    // Extract image URL from description HTML (<img src="..."/>) as fallback
    const descImgMatch = rawDesc?.match(/<img[^>]+src="([^"]+)"/i);
    const ogImage = imgMatch?.[1]?.trim() ?? descImgMatch?.[1]?.trim() ?? null;

    const pubDate = pubDateMatch
      ? (() => { const d = new Date(pubDateMatch[1].trim()); return isNaN(d.getTime()) ? null : d.toISOString(); })()
      : null;

    items.push({ url, title, description, ogImage, pubDate });
  }

  return items;
}

// ── Fetch all institution feeds ────────────────────────────────────────────────
async function fetchAll() {
  const all = [];
  const seen = new Set();

  for (const { nsid, name, categoryId, subcatId } of INSTITUTIONS) {
    const feedUrl = rssUrl(nsid);
    let res;
    try {
      res = await fetchWithRetry(feedUrl, {
        headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
      }, { retries: 2, base: 2000 });
    } catch (err) {
      console.warn(`[flickr-commons] ${name}: ${err.message}`);
      await sleep(DELAY_MS);
      continue;
    }

    if (!res.ok) {
      console.warn(`[flickr-commons] ${name}: HTTP ${res.status}`);
      await sleep(DELAY_MS);
      continue;
    }

    const xml   = await res.text();
    const items = parseFeed(xml);
    let added = 0;

    for (const { url, title, description, ogImage, pubDate } of items) {
      if (!seen.has(url)) {
        seen.add(url);
        all.push({
          url,
          title,
          description,
          og_image_url:   ogImage,
          category_id:    categoryId,
          subcategory_id: subcatId,
          source:         'flickr-commons',
          published_at:   pubDate,
          language:       'en',
        });
        added++;
      }
    }

    console.log(`[flickr-commons] ${name}: ${added} photos (total=${all.length})`);
    await sleep(DELAY_MS);
  }

  return all;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Flickr: The Commons seeder ===\n');

  let all;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    all = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[flickr-commons] Loaded ${all.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    all = await fetchAll();
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(all));
    console.log(`[flickr-commons] Cached ${all.length} rows`);
  }

  console.log(`\n[flickr-commons] Total: ${all.length} — upserting...`);
  // fetchOg=false — og:image and description come directly from the RSS feed.
  const result = await upsertUrls(all, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
