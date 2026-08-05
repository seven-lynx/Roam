/**
 * seed-planetmoney.mjs — Planet Money / The Indicator seeder via NPR API
 * Economics explainers, behavioral economics stories.
 * Category: HISTORY_IDEAS → ECONOMICS_HISTORY
 */
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { config as dotenvConfig } from "dotenv";
import { upsertUrls, CATEGORY, SUBCATEGORY, fetchWithRetry } from "./lib/seed.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../.env") });
const CACHE_DIR = resolve(__dirname, ".cache");
const CACHE_FILE = resolve(CACHE_DIR, "planetmoney.json");
mkdirSync(CACHE_DIR, { recursive: true });
const NO_CACHE = process.argv.includes("--no-cache");
const NPR_KEY = process.env.NPR_API_KEY;
if (!NPR_KEY) { console.error("Missing NPR_API_KEY"); process.exit(1); }
const UA = "Roam-Seeder/1.0 (+https://roamtheweb.app)";
const PROGRAMS = [{id:"510289", name:"planet-money"}, {id:"510325", name:"the-indicator"}];
const PER_PAGE = 500;
const MAX_PAGES_PER = 4;

async function fetchStories(){
  const rows = [];
  for (const prog of PROGRAMS) {
    for (let page = 0; page < MAX_PAGES_PER; page++) {
      const startNum = page * PER_PAGE + 1;
      const url = `https://api.npr.org/query?id=${prog.id}&apiKey=${NPR_KEY}&format=json&numResults=${PER_PAGE}&startNum=${startNum}&requiredAssets=image,text`;
      console.log(`  Fetching ${prog.name} page ${page+1}...`);
      const res = await fetchWithRetry(url, {headers:{"User-Agent":UA}});
      if (!res) { console.warn(`  Failed page ${page+1}`); continue; }
      const data = await res.json();
      const stories = data?.list?.story || [];
      if (!stories.length) break;
      for (const s of stories) {
        const title = s.title?.$text || s.title || "";
        const description = s.teaser?.$text || s.teaser || "";
        const img = (s.image && s.image[0]?.src) || null;
        const link = (s.link && s.link[0]?.$text) || null;
        if (!title || !link) continue;
        rows.push({
          url: link,
          title: title.trim().slice(0,500),
          description: description?.trim().slice(0,500) || undefined,
          og_image_url: img || undefined,
          category_id: CATEGORY.HISTORY_IDEAS,
          subcategory_id: SUBCATEGORY.ECONOMICS_HISTORY,
          source: "planetmoney",
          seeder_score: 0.8,
        });
      }
      if (stories.length < PER_PAGE) break;
    }
  }
  return rows;
}

async function main(){
  console.log("💰 Planet Money Seeder (NPR API)\n");
  let cache = {};
  if (!NO_CACHE && existsSync(CACHE_FILE)) { try { cache = JSON.parse(readFileSync(CACHE_FILE, "utf8")); } catch { cache = {}; } }
  if (NO_CACHE) cache = {};
  let rows = cache.rows;
  if (!rows || NO_CACHE) {
    console.log("\n📡 Fetching from NPR API...");
    rows = await fetchStories();
    cache.rows = rows;
    if (!NO_CACHE) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log(`  ✓ Fetched ${rows.length} stories`);
  } else { console.log(`\n📡 ${rows.length} stories (cached)`); }
  if (!rows.length) { console.log("\n⚠️ None."); return; }
  console.log(`\n💾 Submitting ${rows.length} stories...`);
  const r = await upsertUrls(rows, { fetchOg: true, checkLive: true, verbose: true });
  console.log(`\n✅ Done! Inserted: ${r.inserted}, Skipped: ${r.skipped}`);
}
main().catch((err) => { console.error("FATAL:", err.message); process.exit(1); });