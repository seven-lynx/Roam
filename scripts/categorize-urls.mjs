/**
 * categorize-urls.mjs — Rule-based subcategory assignment
 *
 * Assigns subcategory_id to URLs that already have category_id but no subcategory_id.
 * Uses source name + URL-path rules — no network requests beyond DB export.
 *
 * Workflow (3 phases):
 *   Phase 1 – Export   SELECT id, url, source, category_id FROM urls
 *                       WHERE subcategory_id IS NULL AND approved=TRUE AND inactive=FALSE
 *                       → .cache/categorize-export.jsonl  (skipped if cache exists)
 *   Phase 2 – Classify Apply source/URL rules to each row → subcategory_id or null
 *                       → .cache/categorize-results.jsonl
 *   Phase 3 – Commit   Batch UPDATE subcategory_id (500 per batch)
 *                       Only runs when --commit is passed (default: dry-run)
 *
 * Usage:
 *   node scripts/categorize-urls.mjs [options]
 *
 * Options:
 *   --dry-run          (default) Export + classify; print summary; no DB writes
 *   --commit           Write results to Supabase
 *   --source <name>    Scope export to one source
 *   --limit <n>        Classify only first N URLs (testing)
 *   --re-export        Re-download URL list even if cache exists
 *   --reset            Delete all cache files and start fresh
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import {
  createWriteStream, existsSync, mkdirSync,
  readFileSync, writeFileSync, unlinkSync,
} from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const EXPORT_FILE  = resolve(CACHE_DIR, 'categorize-export.jsonl');
const RESULTS_FILE = resolve(CACHE_DIR, 'categorize-results.jsonl');

dotenvConfig({ path: resolve(__dirname, '../.env') });

// ── CLI flags ────────────────────────────────────────────────────────────────
const COMMIT    = process.argv.includes('--commit');
const RE_EXPORT = process.argv.includes('--re-export');
const RESET     = process.argv.includes('--reset');

const SOURCE_ARG = (() => {
  const i = process.argv.indexOf('--source');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const LIMIT_ARG = (() => {
  const i = process.argv.indexOf('--limit');
  return i >= 0 ? Math.max(1, parseInt(process.argv[i + 1], 10)) : null;
})();

// ── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const EXPORT_PAGE_SIZE = 1_000;
const DB_BATCH_SIZE    = 500;

// ── Subcategory UUID constants ───────────────────────────────────────────────
const SC = {
  // Science & Nature
  SPACE_ASTRONOMY:         'c2000001-0000-0000-0000-000000000001',
  BIOLOGY_EVOLUTION:       'c2000001-0000-0000-0000-000000000002',
  PHYSICS_CHEMISTRY:       'c2000001-0000-0000-0000-000000000003',
  ENVIRONMENT_CLIMATE:     'c2000001-0000-0000-0000-000000000004',
  MEDICINE_HEALTH_SCIENCE: 'c2000001-0000-0000-0000-000000000005',
  MATHEMATICS_LOGIC:       'c2000001-0000-0000-0000-000000000006',
  GEOLOGY_EARTH_SCIENCE:   'c2000001-0000-0000-0000-000000000007',
  OCEANOGRAPHY_MARINE:     'c2000001-0000-0000-0000-000000000008',
  PALEONTOLOGY:            'c2000001-0000-0000-0000-000000000009',

  // Technology
  PROGRAMMING_SOFTWARE_DEV:  'c2000002-0000-0000-0000-000000000001',
  DESIGN_UX:                 'c2000002-0000-0000-0000-000000000002',
  AI_MACHINE_LEARNING:       'c2000002-0000-0000-0000-000000000003',
  HARDWARE_ELECTRONICS:      'c2000002-0000-0000-0000-000000000004',
  CYBERSECURITY_PRIVACY:     'c2000002-0000-0000-0000-000000000005',
  INTERNET_CULTURE:          'c2000002-0000-0000-0000-000000000006',
  ROBOTICS_AUTOMATION:       'c2000002-0000-0000-0000-000000000007',
  EMERGING_TECHNOLOGY:       'c2000002-0000-0000-0000-000000000008',
  OPEN_SOURCE_DEV:           'c2000002-0000-0000-0000-000000000009',

  // Arts & Culture
  MUSIC:                   'c2000003-0000-0000-0000-000000000001',
  FILM_TELEVISION:         'c2000003-0000-0000-0000-000000000002',
  VISUAL_ART_PAINTING:     'c2000003-0000-0000-0000-000000000003',
  COMICS_ILLUSTRATION:     'c2000003-0000-0000-0000-000000000004',
  LITERATURE_WRITING:      'c2000003-0000-0000-0000-000000000005',
  PHOTOGRAPHY:             'c2000003-0000-0000-0000-000000000006',
  ARCHITECTURE_URBAN:      'c2000003-0000-0000-0000-000000000007',
  THEATRE_PERFORMANCE:     'c2000003-0000-0000-0000-000000000008',
  FASHION_TEXTILES:        'c2000003-0000-0000-0000-000000000009',

  // History & Ideas
  ANCIENT_MEDIEVAL_HISTORY: 'c2000004-0000-0000-0000-000000000001',
  MODERN_HISTORY:           'c2000004-0000-0000-0000-000000000002',
  PHILOSOPHY_ETHICS:        'c2000004-0000-0000-0000-000000000003',
  POLITICS_GEOPOLITICS:     'c2000004-0000-0000-0000-000000000004',
  RELIGION_MYTHOLOGY:       'c2000004-0000-0000-0000-000000000005',
  ANTHROPOLOGY_ARCHAEOLOGY: 'c2000004-0000-0000-0000-000000000006',
  ECONOMICS:                'c2000004-0000-0000-0000-000000000007',
  SOCIAL_HISTORY:           'c2000004-0000-0000-0000-000000000008',
  MILITARY_HISTORY:         'c2000004-0000-0000-0000-000000000009',

  // Games & Hobbies
  VIDEO_GAMES:          'c2000005-0000-0000-0000-000000000001',
  BOARD_GAMES:          'c2000005-0000-0000-0000-000000000002',
  SPORTS_ATHLETICS:     'c2000005-0000-0000-0000-000000000003',
  COOKING_FOOD:         'c2000005-0000-0000-0000-000000000004',
  CRAFTS_DIY:           'c2000005-0000-0000-0000-000000000005',
  COLLECTING:           'c2000005-0000-0000-0000-000000000006',
  OUTDOOR_ACTIVITIES:   'c2000005-0000-0000-0000-000000000007',
  GARDENING:            'c2000005-0000-0000-0000-000000000008',
  PUZZLES_BRAIN:        'c2000005-0000-0000-0000-000000000009',

  // Weird & Wonderful
  ODDITIES_CURIOSITIES:   'c2000006-0000-0000-0000-000000000001',
  TRUE_CRIME:             'c2000006-0000-0000-0000-000000000002',
  PARANORMAL:             'c2000006-0000-0000-0000-000000000003',
  VINTAGE_INTERNET:       'c2000006-0000-0000-0000-000000000004',
  ABSURDIST_HUMOUR:       'c2000006-0000-0000-0000-000000000005',
  URBAN_LEGENDS_FOLKLORE: 'c2000006-0000-0000-0000-000000000006',
  CONSPIRACY_FRINGE:      'c2000006-0000-0000-0000-000000000007',
  UNUSUAL_PLACES:         'c2000006-0000-0000-0000-000000000008',
  LOST_MEDIA:             'c2000006-0000-0000-0000-000000000009',

  // People & Places
  TRAVEL_EXPLORATION:       'c2000007-0000-0000-0000-000000000001',
  CITIES_URBAN_LIFE:        'c2000007-0000-0000-0000-000000000002',
  BIOGRAPHIES_PROFILES:     'c2000007-0000-0000-0000-000000000003',
  LANGUAGES_LINGUISTICS:    'c2000007-0000-0000-0000-000000000004',
  INDIGENOUS_CULTURES:      'c2000007-0000-0000-0000-000000000005',
  SUBCULTURES:              'c2000007-0000-0000-0000-000000000006',
  MIGRATION_DIASPORA:       'c2000007-0000-0000-0000-000000000007',
  MAPS_CARTOGRAPHY:         'c2000007-0000-0000-0000-000000000008',
  FESTIVALS_CUSTOMS:        'c2000007-0000-0000-0000-000000000009',

  // Mind & Body
  PSYCHOLOGY:              'c2000008-0000-0000-0000-000000000001',
  MENTAL_HEALTH:           'c2000008-0000-0000-0000-000000000002',
  FITNESS_MOVEMENT:        'c2000008-0000-0000-0000-000000000003',
  NUTRITION_HEALTH:        'c2000008-0000-0000-0000-000000000004',
  NEUROSCIENCE:            'c2000008-0000-0000-0000-000000000005',
  MINDFULNESS_MEDITATION:  'c2000008-0000-0000-0000-000000000006',
  SLEEP_RECOVERY:          'c2000008-0000-0000-0000-000000000007',
  RELATIONSHIPS:           'c2000008-0000-0000-0000-000000000008',
  PERSONAL_DEVELOPMENT:    'c2000008-0000-0000-0000-000000000009',
};

// ── Category UUID constants (used for Smithsonian cross-reference) ───────────
const CAT = {
  SCIENCE_NATURE: 'c1000000-0000-0000-0000-000000000001',
  TECHNOLOGY:     'c1000000-0000-0000-0000-000000000002',
  ARTS_CULTURE:   'c1000000-0000-0000-0000-000000000003',
  HISTORY_IDEAS:  'c1000000-0000-0000-0000-000000000004',
  GAMES_HOBBIES:  'c1000000-0000-0000-0000-000000000005',
  WEIRD:          'c1000000-0000-0000-0000-000000000006',
  PEOPLE_PLACES:  'c1000000-0000-0000-0000-000000000007',
  MIND_BODY:      'c1000000-0000-0000-0000-000000000008',
};

// ── Tier 1: Whole-source mappings ─────────────────────────────────────────────
const WHOLE_SOURCE_MAP = {
  nasa:          SC.SPACE_ASTRONOMY,
  bandcamp:      SC.MUSIC,
  boardgamegeek: SC.BOARD_GAMES,
  itchio:        SC.VIDEO_GAMES,
  librivox:      SC.LITERATURE_WRITING,
  gutenberg:     SC.LITERATURE_WRITING,
  wikivoyage:    SC.TRAVEL_EXPLORATION,
  lobsters:      SC.PROGRAMMING_SOFTWARE_DEV,
  openlibrary:   SC.LITERATURE_WRITING,
};

// ── Reddit subreddit → subcategory ───────────────────────────────────────────
// Case-insensitive lookup built from seed-reddit.js SUBREDDITS array
const SUBREDDIT_MAP = (() => {
  const m = new Map();
  const add = (sub, sc) => m.set(sub.toLowerCase(), sc);

  // Technology
  add('programming',      SC.PROGRAMMING_SOFTWARE_DEV);
  add('webdev',           SC.PROGRAMMING_SOFTWARE_DEV);
  add('devops',           SC.PROGRAMMING_SOFTWARE_DEV);
  add('machinelearning',  SC.AI_MACHINE_LEARNING);
  add('opensource',       SC.OPEN_SOURCE_DEV);
  add('netsec',           SC.CYBERSECURITY_PRIVACY);

  // Science
  add('science',   SC.BIOLOGY_EVOLUTION);
  add('space',     SC.SPACE_ASTRONOMY);
  add('physics',   SC.PHYSICS_CHEMISTRY);
  add('biology',   SC.BIOLOGY_EVOLUTION);
  add('chemistry', SC.PHYSICS_CHEMISTRY);

  // Mind & Body
  add('nutrition',    SC.NUTRITION_HEALTH);
  add('fitness',      SC.FITNESS_MOVEMENT);
  add('meditation',   SC.MINDFULNESS_MEDITATION);
  add('psychology',   SC.PSYCHOLOGY);
  add('mentalhealth', SC.MENTAL_HEALTH);

  // History & Ideas
  add('history',       SC.MODERN_HISTORY);
  add('askhistorians', SC.MODERN_HISTORY);
  add('philosophy',    SC.PHILOSOPHY_ETHICS);
  add('geopolitics',   SC.POLITICS_GEOPOLITICS);

  // Arts & Culture
  add('books',      SC.LITERATURE_WRITING);
  add('literature', SC.LITERATURE_WRITING);
  add('writing',    SC.LITERATURE_WRITING);
  add('poetry',     SC.LITERATURE_WRITING);
  add('art',        SC.VISUAL_ART_PAINTING);
  add('design',     SC.DESIGN_UX);
  add('architecture', SC.ARCHITECTURE_URBAN);
  add('movies',     SC.FILM_TELEVISION);
  add('music',      SC.MUSIC);

  // People & Places
  add('travel',     SC.TRAVEL_EXPLORATION);
  add('solotravel', SC.TRAVEL_EXPLORATION);
  add('geography',  SC.MAPS_CARTOGRAPHY);

  // Games & Hobbies
  add('boardgames',  SC.BOARD_GAMES);
  add('chess',       SC.BOARD_GAMES);
  add('diy',         SC.CRAFTS_DIY);
  add('homebrewing', SC.COOKING_FOOD);

  return m;
})();

// ── Guardian section → subcategory ───────────────────────────────────────────
// URL pattern: theguardian.com/{section}/...
const GUARDIAN_SECTION_MAP = {
  'science':      SC.BIOLOGY_EVOLUTION,
  'environment':  SC.ENVIRONMENT_CLIMATE,
  'technology':   SC.PROGRAMMING_SOFTWARE_DEV,
  'books':        SC.LITERATURE_WRITING,
  'film':         SC.FILM_TELEVISION,
  'music':        SC.MUSIC,
  'artanddesign': SC.VISUAL_ART_PAINTING,
  'fashion':      SC.FASHION_TEXTILES,
  'world':        SC.POLITICS_GEOPOLITICS,
  'politics':     SC.POLITICS_GEOPOLITICS,
  'business':     SC.ECONOMICS,
  'society':      SC.SOCIAL_HISTORY,
  'lifeandstyle': SC.PERSONAL_DEVELOPMENT,
  'travel':       SC.TRAVEL_EXPLORATION,
  'cities':       SC.CITIES_URBAN_LIFE,
  'sport':        SC.SPORTS_ATHLETICS,
  'food':         SC.COOKING_FOOD,
  'games':        SC.VIDEO_GAMES,
  'culture':      SC.VISUAL_ART_PAINTING,   // broad; arts/culture catch-all
  'stage':        SC.THEATRE_PERFORMANCE,
  'music/features': SC.MUSIC,
  'education':    SC.SOCIAL_HISTORY,
  'media':        SC.INTERNET_CULTURE,
  'commentisfree': SC.POLITICS_GEOPOLITICS,
  'law':          SC.POLITICS_GEOPOLITICS,
  'money':        SC.ECONOMICS,
  'inequality':   SC.SOCIAL_HISTORY,
  'healthcare-network': SC.MEDICINE_HEALTH_SCIENCE,
  'global-development': SC.POLITICS_GEOPOLITICS,
  'uk-news':      SC.POLITICS_GEOPOLITICS,
  'us-news':      SC.POLITICS_GEOPOLITICS,
  'australia-news': SC.POLITICS_GEOPOLITICS,
  'global':       SC.POLITICS_GEOPOLITICS,
  'news':         SC.POLITICS_GEOPOLITICS,
  'uk':           SC.POLITICS_GEOPOLITICS,
  'theobserver':  SC.POLITICS_GEOPOLITICS,
  'tv-and-radio': SC.FILM_TELEVISION,
  'football':     SC.SPORTS_ATHLETICS,
};

// ── Smithsonian: infer subcategory from existing category_id ─────────────────
const SMITHSONIAN_CATEGORY_MAP = {
  [CAT.ARTS_CULTURE]:  SC.VISUAL_ART_PAINTING,
  [CAT.HISTORY_IDEAS]: SC.ANTHROPOLOGY_ARCHAEOLOGY,
  [CAT.SCIENCE_NATURE]: SC.PALEONTOLOGY,
};

// ── Classification logic ─────────────────────────────────────────────────────
/**
 * Given a URL row from the DB, return a subcategory UUID or null.
 * @param {{ id: string, url: string, source: string, category_id: string }} row
 * @returns {string|null}
 */
function classify(row) {
  const { source, url, category_id } = row;

  // Tier 1 — whole-source
  if (WHOLE_SOURCE_MAP[source]) return WHOLE_SOURCE_MAP[source];

  // Reddit — extract subreddit from URL path
  if (source === 'reddit') {
    const m = url.match(/reddit\.com\/r\/([^/?#]+)/i);
    if (m) {
      const sub = m[1].toLowerCase();
      return SUBREDDIT_MAP.get(sub) ?? null;
    }
    return null;
  }

  // Guardian — extract section from first URL path segment
  if (source === 'guardian') {
    try {
      const pathname = new URL(url).pathname;
      const section = pathname.split('/').filter(Boolean)[0] ?? '';
      return GUARDIAN_SECTION_MAP[section] ?? null;
    } catch {
      return null;
    }
  }

  // Smithsonian — infer from existing category_id
  if (source === 'smithsonian') {
    return SMITHSONIAN_CATEGORY_MAP[category_id] ?? null;
  }

  return null;
}

// ── Phase 1: Export ───────────────────────────────────────────────────────────
async function exportUrls() {
  if (existsSync(EXPORT_FILE) && !RE_EXPORT && !RESET) {
    const lineCount = readFileSync(EXPORT_FILE, 'utf-8').split('\n').filter(Boolean).length;
    console.log(`[export] Using cached export (${lineCount.toLocaleString()} URLs). Pass --re-export to refresh.\n`);
    return;
  }

  console.log('[export] Downloading uncategorized URL list from Supabase...');
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  const stream = createWriteStream(EXPORT_FILE);
  let total = 0;
  let page = 0;

  while (true) {
    let query = supabase
      .from('urls')
      .select('id, url, source, category_id, subcategory_id')
      .eq('approved', true)
      .eq('inactive', false)
      .order('source')   // source is likely indexed; avoids full-table sort on id
      .order('id')
      .range(page * EXPORT_PAGE_SIZE, (page + 1) * EXPORT_PAGE_SIZE - 1);

    if (SOURCE_ARG) {
      // Source filter is selective — no IS NULL needed; already-categorised rows
      // are skipped in the classify phase.
      query = query.eq('source', SOURCE_ARG);
    } else {
      // Full export: filter IS NULL so we don't load millions of already-done rows.
      query = query.is('subcategory_id', null);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[export] Query error:', error.message);
      process.exit(1);
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

// ── Phase 2: Classify ─────────────────────────────────────────────────────────
function runClassify() {
  console.log('[classify] Applying rules...');
  const rows = readFileSync(EXPORT_FILE, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((r) => !r.subcategory_id);  // skip already-categorised rows (source-scoped exports)

  const limit = LIMIT_ARG ?? rows.length;
  const scoped = rows.slice(0, limit);

  // Track per-source stats
  const sourceCounts  = {};   // source → { matched, unmatched }
  const subcatCounts  = {};   // subcategoryId → count
  const results = [];

  for (const row of scoped) {
    const src = row.source;
    if (!sourceCounts[src]) sourceCounts[src] = { matched: 0, unmatched: 0 };

    const subcategoryId = classify(row);

    if (subcategoryId) {
      results.push({ id: row.id, subcategoryId });
      sourceCounts[src].matched++;
      subcatCounts[subcategoryId] = (subcatCounts[subcategoryId] ?? 0) + 1;
    } else {
      sourceCounts[src].unmatched++;
    }
  }

  // Write results file
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(
    RESULTS_FILE,
    results.map((r) => JSON.stringify(r)).join('\n') + (results.length ? '\n' : ''),
  );

  // ── Summary ──────────────────────────────────────────────────────────────
  const total   = scoped.length;
  const matched = results.length;
  const pct = total > 0 ? ((matched / total) * 100).toFixed(1) : '0.0';
  console.log(`\n[classify] ${matched.toLocaleString()} / ${total.toLocaleString()} URLs classified (${pct}%)\n`);

  console.log('  Per-source breakdown:');
  const sortedSources = Object.entries(sourceCounts).sort((a, b) => {
    const aTotal = a[1].matched + a[1].unmatched;
    const bTotal = b[1].matched + b[1].unmatched;
    return bTotal - aTotal;
  });
  for (const [src, { matched: m, unmatched: u }] of sortedSources) {
    const total = m + u;
    const pctSrc = ((m / total) * 100).toFixed(0);
    console.log(`    ${src.padEnd(20)} ${m.toLocaleString().padStart(7)} / ${total.toLocaleString().padStart(7)}  (${pctSrc}%)`);
  }

  console.log('');
  return results;
}

// ── Phase 3: Commit ───────────────────────────────────────────────────────────
async function commitResults(results) {
  if (!COMMIT) {
    console.log('[commit] Dry-run mode — no DB writes. Pass --commit to apply.\n');
    return;
  }

  console.log(`[commit] Writing ${results.length.toLocaleString()} subcategory assignments to Supabase...`);

  // Group by subcategory_id for efficient batching
  const bySubcat = new Map();
  for (const { id, subcategoryId } of results) {
    if (!bySubcat.has(subcategoryId)) bySubcat.set(subcategoryId, []);
    bySubcat.get(subcategoryId).push(id);
  }

  let totalUpdated = 0;
  for (const [subcategoryId, ids] of bySubcat) {
    // Chunk into batches of DB_BATCH_SIZE
    for (let i = 0; i < ids.length; i += DB_BATCH_SIZE) {
      const batch = ids.slice(i, i + DB_BATCH_SIZE);
      const { error } = await supabase
        .from('urls')
        .update({ subcategory_id: subcategoryId })
        .in('id', batch);

      if (error) {
        console.error(`[commit] Error updating subcategory ${subcategoryId} (batch ${i}):`, error.message);
        continue;
      }

      totalUpdated += batch.length;
      process.stdout.write(`\r[commit] ${totalUpdated.toLocaleString()} / ${results.length.toLocaleString()} updated...`);
    }
  }

  console.log(`\n[commit] Done. ${totalUpdated.toLocaleString()} URLs updated.\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Reset
  if (RESET) {
    [EXPORT_FILE, RESULTS_FILE].forEach((f) => existsSync(f) && unlinkSync(f));
    console.log('[reset] Cache cleared.\n');
  }

  // Resume state
  const exportExists  = existsSync(EXPORT_FILE);
  const resultsExist  = existsSync(RESULTS_FILE);
  if (exportExists || resultsExist) {
    const exportCount  = exportExists  ? readFileSync(EXPORT_FILE, 'utf-8').split('\n').filter(Boolean).length  : 0;
    const resultsCount = resultsExist  ? readFileSync(RESULTS_FILE, 'utf-8').split('\n').filter(Boolean).length : 0;
    console.log('[resume]');
    console.log(`  export : ${exportCount.toLocaleString()} URLs cached`);
    console.log(`  results: ${resultsCount.toLocaleString()} classified`);
    console.log('');
  }

  await exportUrls();
  const results = runClassify();
  await commitResults(results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
