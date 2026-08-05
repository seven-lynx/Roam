/**
 * seed-olympics.mjs — Olympics.org seeder
 * Olympic Games history, athlete profiles, event records, host city stories.
 * Direct HTML scrape — public site, no bot protection.
 * Category: GAMES_HOBBIES → SPORTS_ATHLETICS
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { config as dotenvConfig } from "dotenv";
import { upsertUrls, CATEGORY, SUBCATEGORY, fetchWithRetry } from "./lib/seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../.env") });
const CACHE_DIR = resolve(__dirname, ".cache");
const CACHE_FILE = resolve(CACHE_DIR, "olympics.json");
mkdirSync(CACHE_DIR, { recursive: true });
const NO_CACHE = process.argv.includes("--no-cache");
const RESET = process.argv.includes("--reset");
const maxUrlsArg = process.argv.find((a) => a.startsWith("--max-urls="));
const MAX_URLS = parseInt(maxUrlsArg?.split("=")[1] || "3000", 10);
const UA = "Roam-Seeder/1.0 (+https://roamtheweb.app)";
const REQUEST_DELAY_MS = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE_URL = "https://olympics.com";
const CONTENT_PATH_RE = /\/(en\/news|en\/athletes|en\/olympic-games|en\/sports|en\/ioc)\//i;

async function discoverUrls() {
  const results = []; const seen = new Set();
  console.log(`  Trying ${BASE_URL}/sitemap.xml...`);
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000);
    const res = await fetchWithRetry(`${BASE_URL}/sitemap.xml`, { headers: { "User-Agent": UA }, signal: c.signal }); clearTimeout(t);
    if (res && res.ok) {
      const xml = await res.text();
      const urlRegex = /<loc>([^<]+)<\/loc>/gi; let m;
      while ((m = urlRegex.exec(xml)) !== null) {
        const url = m[1].trim();
        let p = ""; try { p = new URL(url).pathname; } catch { continue; }
        if (!p || p === "/") continue;
        if (!CONTENT_PATH_RE.test(p)) continue;
        if (seen.has(url)) continue;
        seen.add(url); results.push({ url });
      }
      if (results.length > 0) { console.log(`  ✓ Sitemap found ${results.length} URLs`); return results.slice(0, MAX_URLS); }
    }
  } catch (err) { console.warn(`  Sitemap failed: ${err.message}`); }
  console.log(`  Falling back to index scraping...`);
  const indexPages = ["/en/news/", "/en/athletes/", "/en/olympic-games/", "/en/sports/", "/en/ioc/"];
  for (const ip of indexPages) {
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000);
      const res = await fetchWithRetry(`${BASE_URL}${ip}`, { headers: { "User-Agent": UA }, signal: c.signal }); clearTimeout(t);
      if (!res || !res.ok) continue;
      const html = await res.text();
      const linkRegex = /<a\s[^>]*href=["'](\/[^"'\s]*)["'][^>]*>/gi; let m;
      while ((m = linkRegex.exec(html)) !== null) {
        const href = m[1];
        if (!CONTENT_PATH_RE.test(href)) continue;
        if (href.includes("/search")) continue;
        const url = `${BASE_URL}${href}`;
        if (seen.has(url)) continue;
        seen.add(url); results.push({ url });
      }
      console.log(`  ${ip}: ${results.length} URLs so far`);
    } catch (err) { console.warn(`  Error scraping ${ip}: ${err.message}`); }
    await sleep(REQUEST_DELAY_MS);
  }
  console.log(`  ✓ Found ${results.length} URLs total`);
  return results.slice(0, MAX_URLS);
}

async function fetchPageMeta(pageUrl) {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000);
    const res = await fetchWithRetry(pageUrl, { headers: { "User-Agent": UA }, signal: c.signal }); clearTimeout(t);
    if (!res.ok) return null;
    if (parseInt(res.headers.get("content-length") || "0") > 2_000_000) { clearTimeout(t); return null; }
    const html = await res.text(); clearTimeout(t);
    let title = null;
    const tm = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (tm) title = tm[1].trim().replace(/\s*[\-\|]\s*Olympics\s*$/i, "").trim();
    if (!title) { const og = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i); if (og) title = og[1].trim().replace(/\s*[\-\|]\s*Olympics\s*$/i, "").trim(); else { const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i); if (h1) title = h1[1].trim(); } }
    let desc = null;
    const od = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    const md = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const rd = od?.[1]?.trim() ?? md?.[1]?.trim() ?? null; if (rd) desc = rd.slice(0, 500);
    let img = null;
    const oi = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (oi) img = oi[1].trim(); if (!img) { const tw = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i); if (tw) img = tw[1].trim(); }
    return { title, description: desc, og_image_url: img };
  } catch { return null; }
}

async function main() {
  console.log("🏅 Olympics Seeder (Direct Scrape)\n");
  let cache = {}; if (!NO_CACHE && !RESET && existsSync(CACHE_FILE)) { try { cache = JSON.parse(readFileSync(CACHE_FILE, "utf8")); } catch { cache = {}; } }
  if (NO_CACHE || RESET) cache = {}; cache.discovered = cache.discovered || []; cache.fetched = cache.fetched || {};
  let discovered = cache.discovered;
  if (!discovered.length || NO_CACHE || RESET) { console.log(`\n📡 Discovering URLs...`); discovered = await discoverUrls(); cache.discovered = discovered; if (!NO_CACHE) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2)); console.log(`  ✓ ${discovered.length} URLs`); }
  else { console.log(`\n📡 ${discovered.length} URLs (cached)`); }
  if (!discovered.length) { console.log("\n⚠️ None."); return; }
  console.log(`\n🔍 Metadata for ${discovered.length} articles...`);
  const rows = []; let ok = 0, sk = 0;
  for (let i = 0; i < discovered.length; i++) {
    const a = discovered[i]; let meta = cache.fetched[a.url];
    if (!meta || NO_CACHE || RESET) { await sleep(REQUEST_DELAY_MS); meta = await fetchPageMeta(a.url); if (meta) { cache.fetched[a.url] = meta; if (!NO_CACHE) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2)); } }
    if (meta && meta.title) { rows.push({ url: a.url, title: meta.title, description: meta.description || undefined, og_image_url: meta.og_image_url || undefined, category_id: CATEGORY.GAMES_HOBBIES, subcategory_id: SUBCATEGORY.SPORTS_ATHLETICS, source: "olympics", seeder_score: 0.75 }); ok++; } else { sk++; }
    if ((i + 1) % 50 === 0 || i === discovered.length - 1) console.log(`  ${i + 1}/${discovered.length} (${ok} ok, ${sk} skipped)`);
  }
  console.log(`📊 ${rows.length} with metadata`); if (!rows.length) { console.log("\n⚠️ None."); return; }
  console.log(`\n💾 Submitting...`);
  const r = await upsertUrls(rows, { fetchOg: false, checkLive: true, verbose: true });
  console.log(`\n✅ Done! Inserted: ${r.inserted}, Skipped: ${r.skipped}`);
}
main().catch((err) => { console.error("FATAL:", err.message); process.exit(1); });