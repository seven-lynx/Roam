/**
 * seed-caranddriver.mjs — Car and Driver seeder
 *
 * Multi-method seeder using 4-tier fallback: RSS → Sitemap → Wayback CDX → homepage RSS autodiscovery.
 * Car and Driver is one of the oldest automotive publications — car reviews,
 * comparison tests, features, buyer's guides, and automotive technology deep-dives.
 *
 * Run from repo root:
 *   node scripts/seed-caranddriver.mjs
 *   node scripts/seed-caranddriver.mjs --no-cache
 *
 * Category: GAMES_HOBBIES → SPORTS_ATHLETICS
 */

import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "caranddriver.com",
  cacheFileName: "caranddriver.json",
  displayName: "🏎️ Car and Driver",
  feedUrl: "https://www.caranddriver.com/rss/all.xml",
  articlePathRegex: /\/(news|reviews|features|auto-shows|buying-guide)\//i,
  skipPaths: [
    /\/search(\/|$)/,
    /\/about(\/|$)/,
    /\/contact(\/|$)/,
    /\/privacy(\/|$)/,
    /\/terms(\/|$)/,
    /\/subscribe(\/|$)/,
    /\/newsletter(\/|$)/,
    /\/rss(\/|$)/,
    /\/sitemap(\/|$)/,
    /\/account(\/|$)/,
    /\/login(\/|$)/,
    /\/register(\/|$)/,
    /\/video(\/|$)/,
    /\/gallery(\/|$)/,
    /\/podcast(\/|$)/,
    /\/store(\/|$)/,
    /\/careers(\/|$)/,
    /\/advertise(\/|$)/,
    /\/search\//,
    /\/about\//,
    /\/contact\//,
    /\/privacy\//,
    /\/terms\//,
    /\/subscribe\//,
    /\/newsletter\//,
    /\/rss\//,
    /\/account\//,
    /\/login\//,
    /\/register\//,
    /\/video\//,
    /\/gallery\//,
    /\/podcast\//,
    /\/store\//,
    /\/careers\//,
    /\/advertise\//,
    /\/tag\//,
    /\/author\//,
    /\/category\//,
    /\/page\//,
  ],
  siteSuffixRegex: /\s*\|\s*Car and Driver\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.SPORTS_ATHLETICS,
  source: "caranddriver",
  seeder_score: 0.7,
  maxArticles: 2000,
  maxPages: 20,
});