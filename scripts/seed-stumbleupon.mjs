/**
 * seed-stumbleupon.mjs — StumbleUpon URL importer
 *
 * Sources StumbleUpon URLs from multiple community datasets and imports them
 * into the Roam database under appropriate category/subcategory mappings.
 *
 * Data Sources (in priority order):
 *   1. Kaggle "StumbleUpon Evergreen Classification" — ~7,400 classified URLs
 *      Download: kaggle.com/datasets/c/18 or pip install kagglehub
 *      Place the TSV at scripts/.cache/stumbleupon-evergreen.tsv
 *
 *   2. Social-ODP-2k9 — ~100k+ URLs with DMOZ/ODP category hierarchy
 *      Download from academic mirrors (Arizona State Univ, U. Pisa)
 *      Place the archive at scripts/.cache/social-odp-2k9/
 *
 *   3. Wayback CDX — millions of raw SU URLs via archive.org CDX API
 *      Extracted automatically by querying stumbleupon.com/url/* snapshots
 *
 *   4. ASU DMML StumbleUpon dataset — user-URL interaction graph
 *      Place the files at scripts/.cache/asu-dmml/
 *
 * Usage (from repo root):
 *   node scripts/seed-stumbleupon.mjs                    # all sources, caches results
 *   node scripts/seed-stumbleupon.mjs --dry-run          # parse only, don't insert
 *   node scripts/seed-stumbleupon.mjs --source=kaggle    # single source
 *   node scripts/seed-stumbleupon.mjs --source=wayback   # Wayback CDX only
 *   node scripts/seed-stumbleupon.mjs --no-cache         # re-fetch from APIs
 */

import fetch from "node-fetch";
import { readFileSync, writeFileSync, mkdirSync, existsSync, createReadStream } from "fs";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import { upsertUrls, CATEGORY, SUBCATEGORY } from "./lib/seed.js";
import { logSeedingRun } from "./log-seeding.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../.env") });

const CACHE_DIR = resolve(__dirname, ".cache");
const CACHE_FILE = resolve(CACHE_DIR, "stumbleupon-progress.json");
const KAGGLE_TSV = resolve(CACHE_DIR, "stumbleupon-evergreen", "stumbleupon-evergreen.tsv");

const NO_CACHE = process.argv.includes("--no-cache");
const DRY_RUN = process.argv.includes("--dry-run");

// Parse --max-cdx-pages=N (default 1 for backward compat; set high e.g. 20 for paginated)
const maxCdxPagesArg = process.argv.find(a => a.startsWith("--max-cdx-pages="));
const MAX_CDX_PAGES = maxCdxPagesArg ? parseInt(maxCdxPagesArg.split("=")[1], 10) || 1 : 1;

const TARGET_SOURCE = process.argv.includes("--source=kaggle") ? "kaggle"
  : process.argv.includes("--source=social-odp") ? "social-odp"
  : process.argv.includes("--source=wayback-yearly") ? "wayback-yearly"
  : process.argv.includes("--source=wayback-paginated") ? "wayback-paginated"
  : process.argv.includes("--source=wayback") ? "wayback"
  : process.argv.includes("--source=asu") ? "asu"
  : process.argv.includes("--source=awesome") ? "awesome"
  : process.argv.includes("--source=fallover") ? "fallover"
  : process.argv.includes("--source=github") ? "github"
  : process.argv.includes("--source=commoncrawl") ? "commoncrawl"
  : process.argv.includes("--source=reddit") ? "reddit"
  : process.argv.includes("--source=extension") ? "extension"
  : "all";

const UA = "Roam-Seeder/1.0 (+https://roamtheweb.app)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── ODP (DMOZ) → Roam category mapping ───────────────────────────────────────
// Maps Open Directory Project top-level and second-level categories
// to Roam's 8-pillar + subcategory system.
const ODP_CATEGORY_MAP = {
  // ── Science ──
  "Top/Science": { cat: CATEGORY.SCIENCE, sub: null },
  "Top/Science/Astronomy": { cat: CATEGORY.SCIENCE, sub: SUBCATEGORY.SPACE_ASTRONOMY },
  "Top/Science/Biology": { cat: CATEGORY.SCIENCE, sub: SUBCATEGORY.BIOLOGY_EVOLUTION },
  "Top/Science/Chemistry": { cat: CATEGORY.SCIENCE, sub: SUBCATEGORY.PHYSICS_CHEMISTRY },
  "Top/Science/Physics": { cat: CATEGORY.SCIENCE, sub: SUBCATEGORY.PHYSICS_CHEMISTRY },
  "Top/Science/Earth_Sciences": { cat: CATEGORY.SCIENCE, sub: SUBCATEGORY.GEOLOGY_EARTH_SCIENCE },
  "Top/Science/Environment": { cat: CATEGORY.SCIENCE, sub: SUBCATEGORY.ENVIRONMENT_CLIMATE },
  "Top/Science/Math": { cat: CATEGORY.SCIENCE, sub: SUBCATEGORY.MATHEMATICS_LOGIC },
  "Top/Science/Social_Sciences": { cat: CATEGORY.MIND_BODY, sub: SUBCATEGORY.PSYCHOLOGY_BEHAVIOUR },
  "Top/Science/Technology": { cat: CATEGORY.TECHNOLOGY, sub: null },

  // ── Arts ──
  "Top/Arts": { cat: CATEGORY.ARTS_CULTURE, sub: null },
  "Top/Arts/Music": { cat: CATEGORY.ARTS_CULTURE, sub: SUBCATEGORY.MUSIC },
  "Top/Arts/Movies": { cat: CATEGORY.ARTS_CULTURE, sub: SUBCATEGORY.FILM_TELEVISION },
  "Top/Arts/Television": { cat: CATEGORY.ARTS_CULTURE, sub: SUBCATEGORY.FILM_TELEVISION },
  "Top/Arts/Visual_Arts": { cat: CATEGORY.ARTS_CULTURE, sub: SUBCATEGORY.VISUAL_ART },
  "Top/Arts/Comics": { cat: CATEGORY.ARTS_CULTURE, sub: SUBCATEGORY.COMICS_ILLUSTRATION },
  "Top/Arts/Literature": { cat: CATEGORY.ARTS_CULTURE, sub: SUBCATEGORY.LITERATURE_WRITING },
  "Top/Arts/Photography": { cat: CATEGORY.ARTS_CULTURE, sub: SUBCATEGORY.PHOTOGRAPHY },
  "Top/Arts/Architecture": { cat: CATEGORY.ARTS_CULTURE, sub: SUBCATEGORY.ARCHITECTURE_URBAN },
  "Top/Arts/Performing_Arts": { cat: CATEGORY.ARTS_CULTURE, sub: SUBCATEGORY.THEATRE_PERFORMANCE },
  "Top/Arts/Design": { cat: CATEGORY.ARTS_CULTURE, sub: SUBCATEGORY.DESIGN_UX },
  "Top/Arts/Animation": { cat: CATEGORY.ARTS_CULTURE, sub: SUBCATEGORY.ANIME_MANGA },

  // ── Computers ──
  "Top/Computers": { cat: CATEGORY.TECHNOLOGY, sub: null },
  "Top/Computers/Programming": { cat: CATEGORY.TECHNOLOGY, sub: SUBCATEGORY.PROGRAMMING_SOFTWARE },
  "Top/Computers/Internet": { cat: CATEGORY.TECHNOLOGY, sub: SUBCATEGORY.INTERNET_CULTURE },
  "Top/Computers/Software": { cat: CATEGORY.TECHNOLOGY, sub: SUBCATEGORY.PROGRAMMING_SOFTWARE },
  "Top/Computers/Hardware": { cat: CATEGORY.TECHNOLOGY, sub: SUBCATEGORY.HARDWARE_ELECTRONICS },
  "Top/Computers/Security": { cat: CATEGORY.TECHNOLOGY, sub: SUBCATEGORY.CYBERSECURITY_PRIVACY },
  "Top/Computers/Artificial_Intelligence": { cat: CATEGORY.TECHNOLOGY, sub: SUBCATEGORY.AI_MACHINE_LEARNING },
  "Top/Computers/Robotics": { cat: CATEGORY.TECHNOLOGY, sub: SUBCATEGORY.ROBOTICS_AUTOMATION },
  "Top/Computers/Open_Source": { cat: CATEGORY.TECHNOLOGY, sub: SUBCATEGORY.OPEN_SOURCE },

  // ── Games ──
  "Top/Games": { cat: CATEGORY.GAMES_HOBBIES, sub: null },
  "Top/Games/Video_Games": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.VIDEO_GAMES },
  "Top/Games/Board_Games": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.BOARD_GAMES_TABLETOP },
  "Top/Games/Roleplaying": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.BOARD_GAMES_TABLETOP },

  // ── Health ──
  "Top/Health": { cat: CATEGORY.MIND_BODY, sub: null },
  "Top/Health/Nutrition": { cat: CATEGORY.MIND_BODY, sub: SUBCATEGORY.NUTRITION_HEALTH },
  "Top/Health/Fitness": { cat: CATEGORY.MIND_BODY, sub: SUBCATEGORY.FITNESS_MOVEMENT },
  "Top/Health/Mental_Health": { cat: CATEGORY.MIND_BODY, sub: SUBCATEGORY.MENTAL_HEALTH },
  "Top/Health/Medicine": { cat: CATEGORY.SCIENCE, sub: SUBCATEGORY.MEDICINE_HEALTH_SCIENCE },

  // ── Recreation ──
  "Top/Recreation": { cat: CATEGORY.GAMES_HOBBIES, sub: null },
  "Top/Recreation/Food": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.COOKING_FOOD },
  "Top/Recreation/Outdoors": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.OUTDOOR_ADVENTURE },
  "Top/Recreation/Travel": { cat: CATEGORY.PEOPLE_PLACES, sub: SUBCATEGORY.TRAVEL_EXPLORATION },
  "Top/Recreation/Pets": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.PETS_ANIMALS },
  "Top/Recreation/Collecting": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.COLLECTING },
  "Top/Recreation/Crafts": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.CRAFTS_DIY_MAKING },
  "Top/Recreation/Gardening": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.GARDENING_HORTICULTURE },
  "Top/Recreation/Autos": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.CARS_AUTOMOTIVE },

  // ── Society ──
  "Top/Society": { cat: CATEGORY.PEOPLE_PLACES, sub: null },
  "Top/Society/History": { cat: CATEGORY.HISTORY_IDEAS, sub: SUBCATEGORY.MODERN_HISTORY },
  "Top/Society/Philosophy": { cat: CATEGORY.HISTORY_IDEAS, sub: SUBCATEGORY.PHILOSOPHY_ETHICS },
  "Top/Society/Politics": { cat: CATEGORY.HISTORY_IDEAS, sub: SUBCATEGORY.POLITICS_GEOPOLITICS },
  "Top/Society/Religion": { cat: CATEGORY.HISTORY_IDEAS, sub: SUBCATEGORY.RELIGION_MYTHOLOGY },
  "Top/Society/Law": { cat: CATEGORY.HISTORY_IDEAS, sub: SUBCATEGORY.POLITICS_GEOPOLITICS },
  "Top/Society/Issues": { cat: CATEGORY.HISTORY_IDEAS, sub: SUBCATEGORY.SOCIAL_HISTORY },

  // ── Sports ──
  "Top/Sports": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.SPORTS_ATHLETICS },
  "Top/Sports/Soccer": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.SPORTS_ATHLETICS },
  "Top/Sports/Basketball": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.SPORTS_ATHLETICS },
  "Top/Sports/Baseball": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.SPORTS_ATHLETICS },
  "Top/Sports/Football": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.SPORTS_ATHLETICS },
  "Top/Sports/Martial_Arts": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.MMA_COMBAT_SPORTS },
  "Top/Sports/Motorsports": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.CARS_AUTOMOTIVE },
  "Top/Sports/Extreme": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.SNOW_SPORTS },

  // ── News ──
  "Top/News": { cat: CATEGORY.HISTORY_IDEAS, sub: SUBCATEGORY.POLITICS_GEOPOLITICS },
  "Top/News/Weird_News": { cat: CATEGORY.WEIRD_WONDERFUL, sub: SUBCATEGORY.ODDITIES_CURIOSITIES },

  // ── Business ──
  "Top/Business": { cat: CATEGORY.HISTORY_IDEAS, sub: SUBCATEGORY.ECONOMICS_HISTORY },
  "Top/Business/Investing": { cat: CATEGORY.HISTORY_IDEAS, sub: SUBCATEGORY.ECONOMICS_HISTORY },
  "Top/Business/Personal_Finance": { cat: CATEGORY.HISTORY_IDEAS, sub: SUBCATEGORY.ECONOMICS_HISTORY },

  // ── Home ──
  "Top/Home": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.CRAFTS_DIY_MAKING },
  "Top/Home/Cooking": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.COOKING_FOOD },
  "Top/Home/Gardening": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.GARDENING_HORTICULTURE },

  // ── Regional ──
  "Top/Regional": { cat: CATEGORY.PEOPLE_PLACES, sub: SUBCATEGORY.TRAVEL_EXPLORATION },

  // ── Reference ──
  "Top/Reference": { cat: CATEGORY.HISTORY_IDEAS, sub: null },
  "Top/Reference/Education": { cat: CATEGORY.MIND_BODY, sub: SUBCATEGORY.PERSONAL_DEVELOPMENT },
  "Top/Reference/Maps": { cat: CATEGORY.PEOPLE_PLACES, sub: SUBCATEGORY.MAPS_CARTOGRAPHY },

  // ── Kids ──
  "Top/Kids_and_Teens": { cat: CATEGORY.WEIRD_WONDERFUL, sub: null },

  // ── Shopping ──
  "Top/Shopping": { cat: CATEGORY.WEIRD_WONDERFUL, sub: null },
  "Top/Shopping/Clothing": { cat: CATEGORY.ARTS_CULTURE, sub: SUBCATEGORY.FASHION_TEXTILES },
};

// ── Kaggle Evergreen alchemy_category → Roam subcategory ────────────────────
const ALCHEMY_CATEGORY_MAP = {
  "arts_entertainment": { cat: CATEGORY.ARTS_CULTURE, sub: null },
  "auto": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.CARS_AUTOMOTIVE },
  "business": { cat: CATEGORY.HISTORY_IDEAS, sub: SUBCATEGORY.ECONOMICS_HISTORY },
  "careers": { cat: CATEGORY.MIND_BODY, sub: SUBCATEGORY.PERSONAL_DEVELOPMENT },
  "computer_internet": { cat: CATEGORY.TECHNOLOGY, sub: SUBCATEGORY.INTERNET_CULTURE },
  "culture_politics": { cat: CATEGORY.HISTORY_IDEAS, sub: SUBCATEGORY.POLITICS_GEOPOLITICS },
  "gaming": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.VIDEO_GAMES },
  "health": { cat: CATEGORY.MIND_BODY, sub: SUBCATEGORY.MENTAL_HEALTH },
  "law_crime": { cat: CATEGORY.WEIRD_WONDERFUL, sub: SUBCATEGORY.TRUE_CRIME_MYSTERIES },
  "lifestyle": { cat: CATEGORY.MIND_BODY, sub: SUBCATEGORY.PERSONAL_DEVELOPMENT },
  "movies": { cat: CATEGORY.ARTS_CULTURE, sub: SUBCATEGORY.FILM_TELEVISION },
  "music": { cat: CATEGORY.ARTS_CULTURE, sub: SUBCATEGORY.MUSIC },
  "non_standard": { cat: CATEGORY.WEIRD_WONDERFUL, sub: SUBCATEGORY.ODDITIES_CURIOSITIES },
  "pets_animals": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.PETS_ANIMALS },
  "photo_video": { cat: CATEGORY.ARTS_CULTURE, sub: SUBCATEGORY.PHOTOGRAPHY },
  "religion": { cat: CATEGORY.HISTORY_IDEAS, sub: SUBCATEGORY.RELIGION_MYTHOLOGY },
  "science_technology": { cat: CATEGORY.SCIENCE, sub: null },
  "sports": { cat: CATEGORY.GAMES_HOBBIES, sub: SUBCATEGORY.SPORTS_ATHLETICS },
  "travel": { cat: CATEGORY.PEOPLE_PLACES, sub: SUBCATEGORY.TRAVEL_EXPLORATION },
  "unknown": { cat: CATEGORY.WEIRD_WONDERFUL, sub: SUBCATEGORY.ODDITIES_CURIOSITIES },
  "weather": { cat: CATEGORY.SCIENCE, sub: SUBCATEGORY.ENVIRONMENT_CLIMATE },
  "?" : { cat: CATEGORY.WEIRD_WONDERFUL, sub: SUBCATEGORY.ODDITIES_CURIOSITIES },
};

// ── Progress management ──────────────────────────────────────────────────────
function loadProgress() {
  if (!existsSync(CACHE_FILE)) {
    return { phases: { kaggle: false, socialOdp: false, wayback: false, asu: false, awesome: false, fallover: false }, rows: [] };
  }
  return JSON.parse(readFileSync(CACHE_FILE, "utf8"));
}

function saveProgress(progress) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(progress, null, 2));
}

// ── Title cleaning ───────────────────────────────────────────────────────────
function cleanTitle(title, siteSuffixRegex) {
  if (!title) return null;
  let t = title.trim()
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");
  if (siteSuffixRegex) t = t.replace(siteSuffixRegex, "").trim();
  return t || null;
}

function cleanDescription(desc) {
  if (!desc) return null;
  let d = desc.trim()
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");
  return d.slice(0, 500) || null;
}

// ── Validate URL ─────────────────────────────────────────────────────────────
function isValidHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 1: Kaggle Evergreen Dataset
// ═══════════════════════════════════════════════════════════════════════════════
async function parseKaggleEvergreen() {
  console.log("\n─── Source 1: Kaggle Evergreen Dataset ───\n");

  if (!existsSync(KAGGLE_TSV)) {
    console.log("  ⚠️  Kaggle dataset not found at scripts/.cache/stumbleupon-evergreen.tsv");
    console.log("  Download from: https://www.kaggle.com/datasets/c/18");
    console.log("  Or use: pip install kagglehub && python -c \"import kagglehub; kagglehub.dataset_download('c/18')\"");
    console.log("  Place the train.tsv file at scripts/.cache/stumbleupon-evergreen.tsv");
    return [];
  }

  console.log("  Parsing Kaggle TSV...");
  const rows = [];
  const fileStream = createReadStream(KAGGLE_TSV);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  let header = null;
  let lineNum = 0;
  let urlIdx, boilerplateIdx, alchemyIdx, labelIdx;

  for await (const line of rl) {
    lineNum++;
    if (!line.trim()) continue;

    const cols = line.split("\t");
    if (!header) {
      header = cols.map((c) => c.replace(/^"|"$/g, ""));
      urlIdx = header.indexOf("url");
      boilerplateIdx = header.indexOf("boilerplate");
      alchemyIdx = header.indexOf("alchemy_category");
      labelIdx = header.indexOf("label");
      if (urlIdx === -1) {
        console.error("  ❌ Could not find 'url' column in Kaggle TSV");
        return [];
      }
      continue;
    }

    const url = cols[urlIdx]?.replace(/^"|"$/g, "").trim();
    if (!url || !isValidHttpUrl(url)) continue;

    const boilerplate = boilerplateIdx !== -1 ? cols[boilerplateIdx].replace(/^"|"$/g, "") : "";
    const alchemyCat = alchemyIdx !== -1 ? cols[alchemyIdx]?.replace(/^"|"$/g, "").trim().toLowerCase() : "unknown";
    const label = labelIdx !== -1 ? cols[labelIdx]?.replace(/^"|"$/g, "") : null;
    const isEvergreen = label === "1";

    // Extract title from boilerplate — it's typically the first <title> or the URL itself
    let title = null;
    let description = null;

    if (boilerplate) {
      const titleMatch = boilerplate.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = cleanTitle(titleMatch[1], /\s*[\|\-–—]\s*.+$/);
      }
      if (!description) {
        // Try to get a description from meta tags in boilerplate
        const descMatch = boilerplate.match(
          /<meta\s+(?:name=["']description["']\s+|property=["']og:description["']\s+)content=["']([^"']+)["']/i
        ) ?? boilerplate.match(
          /<meta\s+content=["']([^"']+)["']\s+(?:name=["']description["']|property=["']og:description["'])/i
        );
        if (descMatch) description = cleanDescription(descMatch[1]);
      }
      // Fallback: first substantial text from body
      if (!description) {
        const bodyMatch = boilerplate.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          const text = bodyMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          if (text.length > 20) description = cleanDescription(text);
        }
      }
    }

    if (!title) {
      // Use URL path as title fallback
      try {
        const path = new URL(url).pathname.replace(/\/$/, "");
        const slug = path.split("/").filter(Boolean).pop() || path;
        title = slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      } catch {
        continue;
      }
    }

    const mapping = ALCHEMY_CATEGORY_MAP[alchemyCat] || ALCHEMY_CATEGORY_MAP["unknown"];
    rows.push({
      url,
      title,
      description: description || undefined,
      category_id: mapping.cat,
      subcategory_id: mapping.sub,
      source: "stumbleupon",
      seeder_score: isEvergreen ? 0.75 : 0.6,
    });

    if (rows.length % 1000 === 0) console.log(`    Parsed ${rows.length} rows...`);
  }

  console.log(`  ✅ Kaggle: ${rows.length} rows extracted`);
  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 2: Social-ODP-2k9 Dataset
// ═══════════════════════════════════════════════════════════════════════════════
async function parseSocialOdp() {
  console.log("\n─── Source 2: Social-ODP-2k9 Dataset ───\n");

  const ODP_DIR = resolve(CACHE_DIR, "social-odp-2k9");
  if (!existsSync(ODP_DIR)) {
    console.log("  ⚠️  Social-ODP-2k9 not found at scripts/.cache/social-odp-2k9/");
    console.log("  Download from academic mirrors:");
    console.log("    - ASU Digital Repository");
    console.log("    - U. Pisa / U. Bari research page");
    console.log("    - Archive.org search: 'Social-ODP-2k9'");
    console.log("  Place the extracted files in that directory.");
    return [];
  }

  const { readdirSync } = await import("fs");
  const allFiles = readdirSync(ODP_DIR);
  const csvFiles = allFiles.filter(
    (f) => f.endsWith(".csv") || f.endsWith(".tsv") || f.endsWith(".txt") || f.endsWith(".dat")
  );
  const xmlFiles = allFiles.filter((f) => f.endsWith(".xml"));

  if (csvFiles.length === 0 && xmlFiles.length === 0) {
    console.log("  ⚠️  No data files found in social-odp-2k9/ directory");
    return [];
  }

  console.log(`  Found ${csvFiles.length + xmlFiles.length} file(s): ${[...csvFiles, ...xmlFiles].join(", ")}`);
  const rows = [];

  // ── Helper: map ODP category path to Roam category/subcategory ──────────
  function mapOdpCategory(odpCat) {
    if (!odpCat) return { cat: CATEGORY.WEIRD_WONDERFUL, sub: null };
    let catPath = odpCat;
    while (catPath) {
      if (ODP_CATEGORY_MAP[catPath]) return ODP_CATEGORY_MAP[catPath];
      const lastSlash = catPath.lastIndexOf("/");
      if (lastSlash === -1) break;
      catPath = catPath.slice(0, lastSlash);
    }
    return { cat: CATEGORY.WEIRD_WONDERFUL, sub: null };
  }

  // ── CSV/TSV handler ─────────────────────────────────────────────────────
  for (const file of csvFiles) {
    const filePath = resolve(ODP_DIR, file);
    console.log(`  Processing ${file} (CSV/TSV)...`);
    const fileStream = createReadStream(filePath);
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

    let header = null;
    let urlIdx = -1, titleIdx = -1, descIdx = -1, catIdx = -1;

    for await (const line of rl) {
      if (!line.trim()) continue;
      const cols = line.split("\t").length > 1 ? line.split("\t") : line.split(",");

      if (!header) {
        header = cols.map((c) => c.toLowerCase().trim().replace(/^"|"$/g, ""));
        urlIdx = header.findIndex((h) => h === "url" || h === "link" || h === "href");
        titleIdx = header.findIndex((h) => h === "title" || h === "name");
        descIdx = header.findIndex((h) => h === "description" || h === "desc" || h === "summary");
        catIdx = header.findIndex((h) => h === "category" || h === "odp_category" || h === "dmoz_category" || h === "cat" || h === "topic");
        if (urlIdx === -1) { console.error(`  ❌ No URL column in ${file}`); break; }
        continue;
      }

      const url = cols[urlIdx]?.trim().replace(/^"|"$/g, "");
      if (!url || !isValidHttpUrl(url)) continue;

      const title = titleIdx !== -1 ? cols[titleIdx]?.trim().replace(/^"|"$/g, "") : null;
      const description = descIdx !== -1 ? cols[descIdx]?.trim().replace(/^"|"$/g, "").slice(0, 500) : null;
      const odpCat = catIdx !== -1 ? cols[catIdx]?.trim().replace(/^"|"$/g, "") : null;
      const { cat, sub } = mapOdpCategory(odpCat);

      rows.push({
        url, title: cleanTitle(title, null) || undefined,
        description: cleanDescription(description) || undefined,
        category_id: cat, subcategory_id: sub,
        source: "stumbleupon", seeder_score: 0.7,
      });
      if (rows.length % 5000 === 0) console.log(`    Parsed ${rows.length} rows...`);
    }
  }

  // ── XML handler (streaming SAX-style — never loads full file) ────────────
  for (const file of xmlFiles) {
    const filePath = resolve(ODP_DIR, file);
    console.log(`  Processing ${file} (XML streaming)...`);

    const fileStream = createReadStream(filePath, { encoding: "utf8", highWaterMark: 65536 });
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

    let currentUrl = null;
    let currentCategory = null;
    let inUrl = false;
    let inCategory = false;
    let docCount = 0;

    // Single-line tag extraction: <tag>value</tag> on same line
    const urlOpenRe = /<url>([^<]*)<\/url>/i;       // <url>VALUE</url> — capture VALUE
    const catOpenRe = /<category>([^<]*)<\/category>/i;
    const docCloseRe = /^\s*<\/document>/i;

    for await (const line of rl) {
      // Try single-line match first
      const urlMatch = line.match(urlOpenRe);
      if (urlMatch) {
        currentUrl = urlMatch[1].trim();
        continue;
      }

      const catMatch = line.match(catOpenRe);
      if (catMatch) {
        currentCategory = catMatch[1].trim();
        continue;
      }

      if (docCloseRe.test(line)) {
        if (currentUrl && isValidHttpUrl(currentUrl)) {
          const { cat, sub } = mapOdpCategory(currentCategory);
          // Derive title from URL path
          let title = null;
          try {
            const path = new URL(currentUrl).pathname.replace(/\/$/, "");
            const slug = path.split("/").filter(Boolean).pop() || path;
            title = slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          } catch { /* skip */ }

          rows.push({
            url: currentUrl,
            title: title || undefined,
            category_id: cat,
            subcategory_id: sub,
            source: "stumbleupon",
            seeder_score: 0.7,
          });
          docCount++;
        }
        currentUrl = null;
        currentCategory = null;
        if (docCount % 10000 === 0) console.log(`    Parsed ${docCount} documents...`);
      }
    }

    console.log(`    XML: ${docCount} documents extracted`);
  }

  console.log(`  ✅ Social-ODP-2k9: ${rows.length} rows extracted`);
  return rows;
}

// ── Shared CDX parsing helper (used by both single-page and paginated fetches) ─
function parseCdxDataRows(json) {
  const dataRows = json.slice(1);
  const urlSet = new Set();
  let invalid = 0;
  for (const row of dataRows) {
    const original = row[2] || "";
    const match = original.match(/stumbleupon\.com\/url\/(https?:\/\/.+)/i);
    if (match) {
      let destUrl = match[1];
      const qIdx = destUrl.indexOf("?");
      if (qIdx !== -1) {
        const params = new URLSearchParams(destUrl.slice(qIdx + 1));
        params.delete("r");
        params.delete("ts");
        const qs = params.toString();
        destUrl = qs ? destUrl.slice(0, qIdx) + "?" + qs : destUrl.slice(0, qIdx);
      }
      if (isValidHttpUrl(destUrl)) {
        urlSet.add(destUrl);
      } else {
        invalid++;
      }
    }
  }
  return { urls: [...urlSet], invalid };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 3: Wayback CDX API (single page, backward-compatible)
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchWaybackCdx() {
  console.log("\n─── Source 3: Wayback CDX (stumbleupon.com/url/*) ───\n");

  const CDX_CACHE = resolve(CACHE_DIR, "stumbleupon-cdx.json");
  if (!NO_CACHE && existsSync(CDX_CACHE)) {
    const cached = JSON.parse(readFileSync(CDX_CACHE, "utf8"));
    console.log(`  📦 Loaded ${cached.length} cached CDX URLs`);
    return cached.map((r) => ({
      url: r.url,
      title: r.title || undefined,
      description: r.description || undefined,
      category_id: CATEGORY.WEIRD_WONDERFUL,
      subcategory_id: SUBCATEGORY.VINTAGE_INTERNET,
      source: "stumbleupon",
      seeder_score: 0.5,
    }));
  }

  console.log("  Querying Wayback CDX API (single page)...");
  const cdxUrl =
    "https://web.archive.org/cdx/search/cdx" +
    "?url=stumbleupon.com/url/*" +
    "&output=json" +
    "&fl=urlkey,timestamp,original,statuscode" +
    "&filter=statuscode:200" +
    "&limit=50000";

  let cdxRows = [];
  try {
    const res = await fetch(cdxUrl, { headers: { "User-Agent": UA } });
    if (!res.ok) {
      console.log(`  ⚠️  CDX API returned ${res.status}`);
      return [];
    }
    const json = await res.json();
    const { urls, invalid } = parseCdxDataRows(json);
    console.log(`  CDX returned ${json.length - 1} raw snapshots`);

    cdxRows = urls.map((url) => ({
      url,
      title: null,
      description: null,
      category_id: CATEGORY.WEIRD_WONDERFUL,
      subcategory_id: SUBCATEGORY.VINTAGE_INTERNET,
      source: "stumbleupon",
      seeder_score: 0.5,
    }));

    console.log(`  Extracted ${cdxRows.length} unique destination URLs (${invalid} invalid)`);
  } catch (err) {
    console.error(`  ❌ CDX fetch error: ${err.message}`);
    return [];
  }

  const cacheData = cdxRows.map((r) => ({ url: r.url }));
  writeFileSync(CDX_CACHE, JSON.stringify(cacheData, null, 2));
  console.log(`  Cached ${cdxRows.length} URLs to ${CDX_CACHE}`);

  return cdxRows;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 3B: Wayback CDX API (PAGINATED — iterates multiple pages)
// Use --source=wayback-paginated --max-cdx-pages=20
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchWaybackCdxPaginated() {
  console.log("\n─── Source 3B: Wayback CDX PAGINATED (stumbleupon.com/url/*) ───\n");

  const PAGINATED_CACHE = resolve(CACHE_DIR, "stumbleupon-cdx-paginated.json");
  const PAGINATED_CHECKPOINT = resolve(CACHE_DIR, "liveness-cdx-paginated.json");

  if (!NO_CACHE && existsSync(PAGINATED_CACHE)) {
    const cached = JSON.parse(readFileSync(PAGINATED_CACHE, "utf8"));
    console.log(`  📦 Loaded ${cached.length} cached paginated CDX URLs`);
    return cached.map((r) => ({
      url: r.url,
      title: r.title || undefined,
      description: r.description || undefined,
      category_id: CATEGORY.WEIRD_WONDERFUL,
      subcategory_id: SUBCATEGORY.VINTAGE_INTERNET,
      source: "stumbleupon",
      seeder_score: 0.5,
    }));
  }

  // Resume from checkpoint if exists
  let startPage = 0;
  if (!NO_CACHE && existsSync(PAGINATED_CHECKPOINT)) {
    const ck = JSON.parse(readFileSync(PAGINATED_CHECKPOINT, "utf8"));
    startPage = ck.nextPage || 0;
    console.log(`  🔄 Resuming from checkpoint: page ${startPage}`);
  }

  const LIMIT = 50000;
  const allUrlSet = new Set();
  let totalInvalid = 0;
  let totalRaw = 0;
  let page = startPage;
  const startTime = Date.now();

  console.log(`  Fetching up to ${MAX_CDX_PAGES} pages × ${LIMIT} = ${(MAX_CDX_PAGES * LIMIT).toLocaleString()} potential snapshots...\n`);

  for (page = startPage; page < MAX_CDX_PAGES; page++) {
    const pageStart = Date.now();
    const cdxUrl =
      `https://web.archive.org/cdx/search/cdx` +
      `?url=stumbleupon.com/url/*` +
      `&output=json` +
      `&fl=urlkey,timestamp,original,statuscode` +
      `&filter=statuscode:200` +
      `&limit=${LIMIT}` +
      `&page=${page}`;

    let json;
    try {
      const res = await fetch(cdxUrl, { headers: { "User-Agent": UA } });
      if (!res.ok) {
        if (res.status === 429) {
          console.log(`  ⚠️  Rate limited at page ${page}. Waiting 30s...`);
          await sleep(30000);
          const retryRes = await fetch(cdxUrl, { headers: { "User-Agent": UA } });
          if (!retryRes.ok) {
            console.log(`  ⚠️  Still failing after retry (${retryRes.status}). Stopping.`);
            break;
          }
          json = await retryRes.json();
        } else {
          console.log(`  ⚠️  CDX API returned ${res.status} at page ${page}. Stopping.`);
          break;
        }
      } else {
        json = await res.json();
      }
    } catch (err) {
      console.error(`  ❌ CDX fetch error at page ${page}: ${err.message}. Saving checkpoint...`);
      writeFileSync(PAGINATED_CHECKPOINT, JSON.stringify({ nextPage: page, totalUrls: allUrlSet.size, totalRaw, totalInvalid }));
      console.log(`  💾 Checkpoint saved. Resume with --no-cache to restart fresh.`);
      break;
    }

    const dataRows = json.slice(1);
    if (dataRows.length === 0) {
      console.log(`  Page ${page}: 0 rows — reached end of index.`);
      break;
    }

    totalRaw += dataRows.length;
    const { urls, invalid } = parseCdxDataRows(json);
    totalInvalid += invalid;
    const beforeSize = allUrlSet.size;
    for (const u of urls) allUrlSet.add(u);
    const newUnique = allUrlSet.size - beforeSize;

    const pageMs = Date.now() - pageStart;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const pct = ((page + 1) / MAX_CDX_PAGES * 100).toFixed(1);
    console.log(`  Page ${page}: ${dataRows.length.toLocaleString()} raw → ${newUnique.toLocaleString()} new unique URLs | total unique: ${allUrlSet.size.toLocaleString()} | ${pageMs}ms | ${elapsed}s elapsed (${pct}% of max pages)`);

    // Save checkpoint every 2 pages
    if (page % 2 === 1) {
      writeFileSync(PAGINATED_CHECKPOINT, JSON.stringify({ nextPage: page + 1, totalUrls: allUrlSet.size, totalRaw, totalInvalid }));
    }

    // Respect rate limits — 1s delay between pages
    if (page < MAX_CDX_PAGES - 1) await sleep(1000);
  }

  const urls = [...allUrlSet];

  // Build rows
  const cdxRows = urls.map((url) => ({
    url,
    title: null,
    description: null,
    category_id: CATEGORY.WEIRD_WONDERFUL,
    subcategory_id: SUBCATEGORY.VINTAGE_INTERNET,
    source: "stumbleupon",
    seeder_score: 0.5,
  }));

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n  ✅ Paginated CDX: ${totalRaw.toLocaleString()} raw → ${cdxRows.length.toLocaleString()} unique URLs across ${page - startPage} pages | ${totalTime}s total | ${totalInvalid} invalid`);

  // Save final cache and delete checkpoint
  const cacheData = cdxRows.map((r) => ({ url: r.url }));
  writeFileSync(PAGINATED_CACHE, JSON.stringify(cacheData, null, 2));
  if (existsSync(PAGINATED_CHECKPOINT)) {
    try { require("fs").unlinkSync(PAGINATED_CHECKPOINT); } catch { /* ok */ }
  }
  console.log(`  💾 Cached ${cdxRows.length} URLs to ${PAGINATED_CACHE}`);

  return cdxRows;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 3C: Wayback CDX API (YEARLY BATCHING — one query per year 2001-2018)
// Use --source=wayback-yearly
// Bypasses the CDX result cap by splitting the broad query into 18 yearly buckets.
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchWaybackCdxYearly() {
  console.log("\n─── Source 3C: Wayback CDX YEARLY BATCHING (stumbleupon.com/url/*) ───\n");

  const YEARLY_CACHE = resolve(CACHE_DIR, "stumbleupon-cdx-yearly.json");
  const YEARLY_CHECKPOINT = resolve(CACHE_DIR, "liveness-cdx-yearly.json");

  if (!NO_CACHE && existsSync(YEARLY_CACHE)) {
    const cached = JSON.parse(readFileSync(YEARLY_CACHE, "utf8"));
    console.log(`  📦 Loaded ${cached.length} cached yearly CDX URLs`);
    return cached.map((r) => ({
      url: r.url,
      title: r.title || undefined,
      description: r.description || undefined,
      category_id: CATEGORY.WEIRD_WONDERFUL,
      subcategory_id: SUBCATEGORY.VINTAGE_INTERNET,
      source: "stumbleupon",
      seeder_score: 0.5,
    }));
  }

  // Resume from checkpoint if exists
  let startYear = 2001;
  let checkpointUrls = new Set();
  let totalRaw = 0;
  let totalInvalid = 0;
  if (!NO_CACHE && existsSync(YEARLY_CHECKPOINT)) {
    const ck = JSON.parse(readFileSync(YEARLY_CHECKPOINT, "utf8"));
    startYear = ck.nextYear || 2001;
    totalRaw = ck.totalRaw || 0;
    totalInvalid = ck.totalInvalid || 0;
    if (ck.urlSet && Array.isArray(ck.urlSet)) {
      for (const u of ck.urlSet) checkpointUrls.add(u);
    }
    console.log(`  🔄 Resuming from checkpoint: year ${startYear}, ${checkpointUrls.size.toLocaleString()} URLs already collected`);
  }

  const END_YEAR = 2018; // SU shut down in 2018
  const LIMIT = 50000;
  const allUrlSet = new Set(checkpointUrls);
  let year = startYear;
  const startTime = Date.now();

  console.log(`  Fetching ${END_YEAR - startYear + 1} year buckets (${startYear}–${END_YEAR})...\n`);

  for (year = startYear; year <= END_YEAR; year++) {
    const yearStart = Date.now();
    const cdxUrl =
      `https://web.archive.org/cdx/search/cdx` +
      `?url=stumbleupon.com/url/*` +
      `&output=json` +
      `&fl=urlkey,timestamp,original,statuscode` +
      `&filter=statuscode:200` +
      `&from=${year}` +
      `&to=${year}` +
      `&limit=${LIMIT}`;

    let json;
    try {
      const res = await fetch(cdxUrl, { headers: { "User-Agent": UA } });
      if (!res.ok) {
        if (res.status === 429) {
          console.log(`  ⚠️  Rate limited at year ${year}. Waiting 30s...`);
          await sleep(30000);
          const retryRes = await fetch(cdxUrl, { headers: { "User-Agent": UA } });
          if (!retryRes.ok) {
            console.log(`  ⚠️  Still failing after retry (${retryRes.status}) at year ${year}. Saving...`);
            break;
          }
          json = await retryRes.json();
        } else {
          console.log(`  ⚠️  CDX API returned ${res.status} at year ${year}.`);
          break;
        }
      } else {
        json = await res.json();
      }
    } catch (err) {
      console.error(`  ❌ CDX fetch error at year ${year}: ${err.message}. Saving checkpoint...`);
      writeFileSync(YEARLY_CHECKPOINT, JSON.stringify({ nextYear: year, totalUrls: allUrlSet.size, totalRaw, totalInvalid, urlSet: [...allUrlSet] }));
      console.log(`  💾 Checkpoint saved.`);
      break;
    }

    const dataRows = json.slice(1);
    if (dataRows.length === 0) {
      console.log(`  Year ${year}: 0 rows — no snapshots found.`);
    } else {
      totalRaw += dataRows.length;
      const { urls, invalid } = parseCdxDataRows(json);
      totalInvalid += invalid;
      const beforeSize = allUrlSet.size;
      for (const u of urls) allUrlSet.add(u);
      const newUnique = allUrlSet.size - beforeSize;

      const pageMs = Date.now() - yearStart;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`  Year ${year}: ${dataRows.length.toLocaleString()} raw → ${newUnique.toLocaleString()} new unique URLs | total unique: ${allUrlSet.size.toLocaleString()} | ${pageMs}ms | ${elapsed}s elapsed`);
    }

    // Save checkpoint every 3 years
    if (year % 3 === 0) {
      writeFileSync(YEARLY_CHECKPOINT, JSON.stringify({ nextYear: year + 1, totalUrls: allUrlSet.size, totalRaw, totalInvalid, urlSet: [...allUrlSet] }));
    }

    // Respect rate limits
    if (year < END_YEAR) await sleep(1000);
  }

  const urls = [...allUrlSet];
  const cdxRows = urls.map((url) => ({
    url,
    title: null,
    description: null,
    category_id: CATEGORY.WEIRD_WONDERFUL,
    subcategory_id: SUBCATEGORY.VINTAGE_INTERNET,
    source: "stumbleupon",
    seeder_score: 0.5,
  }));

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n  ✅ Yearly CDX: ${totalRaw.toLocaleString()} raw → ${cdxRows.length.toLocaleString()} unique URLs across ${year - startYear} years | ${totalTime}s total | ${totalInvalid} invalid`);

  const cacheData = cdxRows.map((r) => ({ url: r.url }));
  writeFileSync(YEARLY_CACHE, JSON.stringify(cacheData, null, 2));
  if (existsSync(YEARLY_CHECKPOINT)) {
    try { require("fs").unlinkSync(YEARLY_CHECKPOINT); } catch { /* ok */ }
  }
  console.log(`  💾 Cached ${cdxRows.length} URLs to ${YEARLY_CACHE}`);

  return cdxRows;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 5: StumbleUponAwesome curated lists
// ═══════════════════════════════════════════════════════════════════════════════
async function parseStumbleUponAwesome() {
  console.log("\n─── Source 5: StumbleUponAwesome Curated Lists ───\n");

  const AWESOME_CACHE = resolve(CACHE_DIR, "stumbleupon-awesome.json");
  if (!existsSync(AWESOME_CACHE)) {
    console.log("  ⚠️  Awesome cache not found. Run: node scripts/extract-stumbleupon-awesome.mjs");
    return [];
  }

  const data = JSON.parse(readFileSync(AWESOME_CACHE, "utf8"));
  console.log(`  📦 Loaded ${data.length} curated URLs from awesome lists`);
  // Map category_id/subcategory_id directly (already UUIDs from extraction)
  return data.map((r) => ({
    url: r.url,
    title: r.title,
    description: r.description || undefined,
    category_id: r.category_id,
    subcategory_id: r.subcategory_id,
    source: "stumbleupon-awesome",
    seeder_score: r.seeder_score || 0.65,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 4: ASU DMML Dataset
// ═══════════════════════════════════════════════════════════════════════════════
async function parseAsuDmml() {
  console.log("\n─── Source 4: ASU DMML StumbleUpon Dataset ───\n");

  const ASU_DIR = resolve(CACHE_DIR, "asu-dmml");
  if (!existsSync(ASU_DIR)) {
    console.log("  ⚠️  ASU DMML dataset not found at scripts/.cache/asu-dmml/");
    console.log("  Download from Arizona State University's DMML lab repository.");
    console.log("  Place data files in that directory.");
    return [];
  }

  const { readdirSync } = await import("fs");
  const files = readdirSync(ASU_DIR).filter(
    (f) => f.endsWith(".csv") || f.endsWith(".tsv") || f.endsWith(".txt") || f.endsWith(".json")
  );

  if (files.length === 0) {
    console.log("  ⚠️  No data files found in asu-dmml/ directory");
    return [];
  }

  console.log(`  Found ${files.length} file(s): ${files.join(", ")}`);
  const rows = [];

  for (const file of files) {
    const filePath = resolve(ASU_DIR, file);
    console.log(`  Processing ${file}...`);

    // JSON format (most common for ASU dataset)
    if (file.endsWith(".json")) {
      const data = JSON.parse(readFileSync(filePath, "utf8"));
      const items = Array.isArray(data) ? data : data.data || data.rows || [];
      for (const item of items) {
        const url = item.url || item.link || item.href;
        if (!url || !isValidHttpUrl(url)) continue;
        rows.push({
          url,
          title: item.title || item.name || undefined,
          description: (item.description || item.summary || "").slice(0, 500) || undefined,
          category_id: CATEGORY.WEIRD_WONDERFUL,
          subcategory_id: SUBCATEGORY.VINTAGE_INTERNET,
          source: "stumbleupon",
          seeder_score: 0.55,
        });
      }
    }
    // CSV/TSV format
    else {
      const fileStream = createReadStream(filePath);
      const rl = createInterface({ input: fileStream, crlfDelay: Infinity });
      let header = null;
      let urlIdx = -1, titleIdx = -1, descIdx = -1;

      for await (const line of rl) {
        if (!line.trim()) continue;
        const cols = line.split("\t").length > 1 ? line.split("\t") : line.split(",");
        if (!header) {
          header = cols.map((c) => c.toLowerCase().trim().replace(/^"|"$/g, ""));
          urlIdx = header.findIndex((h) => h === "url" || h === "link" || h === "href");
          titleIdx = header.findIndex((h) => h === "title" || h === "name");
          descIdx = header.findIndex((h) => h === "description" || h === "desc" || h === "summary");
          if (urlIdx === -1) { console.error(`  ❌ No URL column in ${file}`); break; }
          continue;
        }
        const url = cols[urlIdx]?.trim().replace(/^"|"$/g, "");
        if (!url || !isValidHttpUrl(url)) continue;
        rows.push({
          url,
          title: titleIdx !== -1 ? cols[titleIdx]?.trim().replace(/^"|"$/g, "") : undefined,
          description: descIdx !== -1 ? cols[descIdx]?.trim().replace(/^"|"$/g, "").slice(0, 500) : undefined,
          category_id: CATEGORY.WEIRD_WONDERFUL,
          subcategory_id: SUBCATEGORY.VINTAGE_INTERNET,
          source: "stumbleupon",
          seeder_score: 0.55,
        });
      }
    }
    console.log(`    ${rows.length} rows so far`);
  }

  console.log(`  ✅ ASU DMML: ${rows.length} rows extracted`);
  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 6: Fallover dataset (l3gacyb3ta)
// ═══════════════════════════════════════════════════════════════════════════════
async function parseStumbleUponFallover() {
  console.log("\n─── Source 6: Fallover Dataset (l3gacyb3ta) ───\n");

  const FALLOVER_CACHE = resolve(CACHE_DIR, "stumbleupon-fallover.json");
  if (!existsSync(FALLOVER_CACHE)) {
    console.log("  ⚠️  Fallover cache not found. Run: node scripts/extract-stumbleupon-fallover.mjs");
    return [];
  }

  const data = JSON.parse(readFileSync(FALLOVER_CACHE, "utf8"));
  console.log(`  📦 Loaded ${data.length} filtered URLs from fallover dataset`);
  // Map directly from cache (already has category_id/subcategory_id)
  return data.map((r) => ({
    url: r.url,
    title: r.title,
    description: r.description || undefined,
    category_id: r.category_id,
    subcategory_id: r.subcategory_id,
    source: "stumbleupon-fallover",
    seeder_score: r.seeder_score || 0.5,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 7: GitHub search extractor
// ═══════════════════════════════════════════════════════════════════════════════
async function parseStumbleUponGitHub() {
  console.log("\n─── Source 7: GitHub StumbleUpon URL Dumps ───\n");

  const GITHUB_CACHE = resolve(CACHE_DIR, "stumbleupon-github.json");
  if (!existsSync(GITHUB_CACHE)) {
    console.log("  ⚠️  GitHub cache not found. Run: node scripts/extract-stumbleupon-github.mjs");
    return [];
  }

  const data = JSON.parse(readFileSync(GITHUB_CACHE, "utf8"));
  console.log(`  📦 Loaded ${data.length} URLs from GitHub search`);
  return data.map((r) => ({
    url: r.url,
    title: r.title,
    description: r.description || undefined,
    category_id: r.category_id,
    subcategory_id: r.subcategory_id,
    source: "stumbleupon-github",
    seeder_score: r.seeder_score || 0.6,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 10: Browser extension unpacker
// ═══════════════════════════════════════════════════════════════════════════════
async function parseStumbleUponExtension() {
  console.log("\n─── Source 10: StumbleUpon Browser Extension URLs ───\n");

  const EXT_CACHE = resolve(CACHE_DIR, "stumbleupon-extension.json");
  if (!existsSync(EXT_CACHE)) {
    console.log("  ⚠️  Extension cache not found. Run: node scripts/extract-stumbleupon-extension.mjs --xpi=<file> or --crx=<file>");
    return [];
  }

  const data = JSON.parse(readFileSync(EXT_CACHE, "utf8"));
  console.log(`  📦 Loaded ${data.length} URLs from extension files`);
  return data.map((r) => ({
    url: r.url,
    title: r.title,
    description: r.description || undefined,
    category_id: r.category_id,
    subcategory_id: r.subcategory_id,
    source: "stumbleupon-extension",
    seeder_score: r.seeder_score || 0.8,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 9: Reddit Pushshift extractor
// ═══════════════════════════════════════════════════════════════════════════════
async function parseStumbleUponReddit() {
  console.log("\n─── Source 9: Reddit StumbleUpon URL Mentions ───\n");

  const REDDIT_CACHE = resolve(CACHE_DIR, "stumbleupon-reddit.json");
  if (!existsSync(REDDIT_CACHE)) {
    console.log("  ⚠️  Reddit cache not found. Run: node scripts/extract-stumbleupon-reddit.mjs");
    return [];
  }

  const data = JSON.parse(readFileSync(REDDIT_CACHE, "utf8"));
  console.log(`  📦 Loaded ${data.length} URLs from Reddit search`);
  return data.map((r) => ({
    url: r.url,
    title: r.title,
    description: r.description || undefined,
    category_id: r.category_id,
    subcategory_id: r.subcategory_id,
    source: "stumbleupon-reddit",
    seeder_score: r.seeder_score || 0.7,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 8: Common Crawl extractor
// ═══════════════════════════════════════════════════════════════════════════════
async function parseStumbleUponCommonCrawl() {
  console.log("\n─── Source 8: Common Crawl StumbleUpon URLs ───\n");

  const CC_CACHE = resolve(CACHE_DIR, "stumbleupon-commoncrawl.json");
  if (!existsSync(CC_CACHE)) {
    console.log("  ⚠️  Common Crawl cache not found. Run: node scripts/extract-stumbleupon-commoncrawl.mjs");
    return [];
  }

  const data = JSON.parse(readFileSync(CC_CACHE, "utf8"));
  console.log(`  📦 Loaded ${data.length} URLs from Common Crawl`);
  return data.map((r) => ({
    url: r.url,
    title: r.title,
    description: r.description || undefined,
    category_id: r.category_id,
    subcategory_id: r.subcategory_id,
    source: "stumbleupon-commoncrawl",
    seeder_score: r.seeder_score || 0.5,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("========== StumbleUpon URL Importer ==========\n");

  const progress = NO_CACHE ? { phases: { kaggle: false, socialOdp: false, wayback: false, asu: false, awesome: false, fallover: false }, rows: [] } : loadProgress();

  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  const allRows = [];
  const sources = [];
  const startTime = Date.now();

  // ── Source 1: Kaggle ──
  if (TARGET_SOURCE === "all" || TARGET_SOURCE === "kaggle") {
    if (!progress.phases.kaggle || NO_CACHE) {
      const kaggleRows = await parseKaggleEvergreen();
      if (kaggleRows.length > 0) {
        allRows.push(...kaggleRows);
        sources.push("kaggle");
      }
      if (!DRY_RUN) {
        progress.phases.kaggle = true;
        saveProgress(progress);
      }
    } else {
      console.log("\n─── Source 1: Kaggle (cached) ───");
    }
  }

  // ── Source 2: Social-ODP-2k9 ──
  if (TARGET_SOURCE === "all" || TARGET_SOURCE === "social-odp") {
    if (!progress.phases.socialOdp || NO_CACHE) {
      const odpRows = await parseSocialOdp();
      if (odpRows.length > 0) {
        allRows.push(...odpRows);
        sources.push("social-odp");
      }
      if (!DRY_RUN) {
        progress.phases.socialOdp = true;
        saveProgress(progress);
      }
    } else {
      console.log("\n─── Source 2: Social-ODP-2k9 (cached) ───");
    }
  }

  // ── Source 3: Wayback CDX ──
  if (TARGET_SOURCE === "all" || TARGET_SOURCE === "wayback") {
    if (!progress.phases.wayback || NO_CACHE) {
      const wbRows = await fetchWaybackCdx();
      if (wbRows.length > 0) {
        allRows.push(...wbRows);
        sources.push("wayback-cdx");
      }
      if (!DRY_RUN) {
        progress.phases.wayback = true;
        saveProgress(progress);
      }
    } else {
      console.log("\n─── Source 3: Wayback CDX (cached) ───");
    }
  }

  // ── Source 4: ASU DMML ──
  if (TARGET_SOURCE === "all" || TARGET_SOURCE === "asu") {
    if (!progress.phases.asu || NO_CACHE) {
      const asuRows = await parseAsuDmml();
      if (asuRows.length > 0) {
        allRows.push(...asuRows);
        sources.push("asu-dmml");
      }
      if (!DRY_RUN) {
        progress.phases.asu = true;
        saveProgress(progress);
      }
    } else {
      console.log("\n─── Source 4: ASU DMML (cached) ───");
    }
  }

  // ── Source 5: StumbleUponAwesome ──
  if (TARGET_SOURCE === "all" || TARGET_SOURCE === "awesome") {
    if (!progress.phases.awesome || NO_CACHE) {
      const awesomeRows = await parseStumbleUponAwesome();
      if (awesomeRows.length > 0) {
        allRows.push(...awesomeRows);
        sources.push("stumbleupon-awesome");
      }
      if (!DRY_RUN) {
        progress.phases.awesome = true;
        saveProgress(progress);
      }
    } else {
      console.log("\n─── Source 5: StumbleUponAwesome (cached) ───");
    }
  }

  // ── Source 3B: Wayback CDX PAGINATED ──
  if (TARGET_SOURCE === "all" || TARGET_SOURCE === "wayback-paginated") {
    const wbPagRows = await fetchWaybackCdxPaginated();
    if (wbPagRows.length > 0) {
      allRows.push(...wbPagRows);
      sources.push("wayback-cdx-paginated");
    }
  }

  // ── Source 3C: Wayback CDX YEARLY ──
  if (TARGET_SOURCE === "all" || TARGET_SOURCE === "wayback-yearly") {
    const wbYearlyRows = await fetchWaybackCdxYearly();
    if (wbYearlyRows.length > 0) {
      allRows.push(...wbYearlyRows);
      sources.push("wayback-cdx-yearly");
    }
  }

  // ── Source 9: Reddit ──
  if (TARGET_SOURCE === "all" || TARGET_SOURCE === "reddit") {
    const redditRows = await parseStumbleUponReddit();
    if (redditRows.length > 0) {
      allRows.push(...redditRows);
      sources.push("stumbleupon-reddit");
    }
  }

  // ── Source 8: Common Crawl ──
  if (TARGET_SOURCE === "all" || TARGET_SOURCE === "commoncrawl") {
    const ccRows = await parseStumbleUponCommonCrawl();
    if (ccRows.length > 0) {
      allRows.push(...ccRows);
      sources.push("stumbleupon-commoncrawl");
    }
  }

  // ── Source 10: Extension ──
  if (TARGET_SOURCE === "all" || TARGET_SOURCE === "extension") {
    const extRows = await parseStumbleUponExtension();
    if (extRows.length > 0) {
      allRows.push(...extRows);
      sources.push("stumbleupon-extension");
    }
  }

  // ── Source 7: GitHub ──
  if (TARGET_SOURCE === "all" || TARGET_SOURCE === "github") {
    const ghRows = await parseStumbleUponGitHub();
    if (ghRows.length > 0) {
      allRows.push(...ghRows);
      sources.push("stumbleupon-github");
    }
  }

  // ── Source 6: Fallover ──
  if (TARGET_SOURCE === "all" || TARGET_SOURCE === "fallover") {
    if (!progress.phases.fallover || NO_CACHE) {
      const falloverRows = await parseStumbleUponFallover();
      if (falloverRows.length > 0) {
        allRows.push(...falloverRows);
        sources.push("stumbleupon-fallover");
      }
      if (!DRY_RUN) {
        progress.phases.fallover = true;
        saveProgress(progress);
      }
    } else {
      console.log("\n─── Source 6: Fallover (cached) ───");
    }
  }

  // ── Summary ──
  if (allRows.length === 0) {
    console.log("\n⚠️  No URLs extracted from any source. Exiting.");
    console.log("\nTo use this seeder, download at least one dataset:");
    console.log("  1. Kaggle Evergreen: https://www.kaggle.com/datasets/c/18");
    console.log("    → Place train.tsv → scripts/.cache/stumbleupon-evergreen.tsv");
    console.log("  2. Social-ODP-2k9: Search Archive.org or ASU Digital Repository");
    console.log("    → Extract files → scripts/.cache/social-odp-2k9/");
    console.log("  3. Wayback CDX: Automatically queried (needs internet)");
    console.log("  4. ASU DMML: Download from ASU's DMML lab");
    console.log("    → Place files → scripts/.cache/asu-dmml/");
    return;
  }

  // Deduplicate by URL (keep first occurrence — earlier sources have better metadata)
  const urlMap = new Map();
  for (const row of allRows) {
    if (!urlMap.has(row.url)) {
      urlMap.set(row.url, row);
    }
  }
  const deduped = [...urlMap.values()];
  console.log(`\n📊 Total: ${allRows.length} raw rows → ${deduped.length} unique URLs (from ${sources.join(", ")})`);

  // Source breakdown
  console.log("\n  Source breakdown:");
  const sourceCounts = {};
  for (const row of allRows) {
    const s = row.source || "unknown";
    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
  }
  for (const [s, c] of Object.entries(sourceCounts)) {
    console.log(`    ${s}: ${c}`);
  }

  if (DRY_RUN) {
    console.log("\n🔍 --dry-run: skipping database insert. Sample rows (first 10):");
    for (const row of deduped.slice(0, 10)) {
      console.log(`    ${row.title || "(no title)"} — ${row.url}`);
    }
    console.log(`\n  ... and ${deduped.length - 10} more`);
    return;
  }

  // ── Upsert to database ──
  console.log(`\n💾 Upserting ${deduped.length} URLs to database...`);
  const result = await upsertUrls(deduped, {
    fetchOg: false,
    checkLive: true,
    verbose: true,
    requireTitle: TARGET_SOURCE === "fallover" ? false : true,
    checkpointId: `stumbleupon-${TARGET_SOURCE === "all" ? (sources.join('+') || 'combined') : TARGET_SOURCE}`,
  });

  console.log(`\n✅ Done! Inserted: ${result.inserted}, Skipped: ${result.skipped}`);

  // ── Log the run ──
  const duration = Date.now() - startTime;
  try {
    await logSeedingRun({
      seeder: "stumbleupon",
      displayName: "🟠 StumbleUpon Import",
      source: "stumbleupon",
      category: null,
      subcategory: null,
      discovered: allRows.length,
      inserted: result.inserted ?? 0,
      skipped: result.skipped ?? 0,
      dead: result.dead ?? 0,
      duration_ms: duration,
      method: sources.join("+"),
      cache_bytes: existsSync(CACHE_FILE) ? readFileSync(CACHE_FILE, "utf8").length : 0,
    });
  } catch { /* best-effort */ }

  console.log("\n🎉 StumbleUpon import complete!\n");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  console.error(err);
  process.exit(1);
});