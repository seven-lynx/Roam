/**
 * seed-cars-rss.mjs — Car & DIY multi-source seeder
 *
 * Pulls articles from RSS feeds covering car culture, DIY repairs, modding,
 * motorsport, and automotive technology. No API key required.
 *
 * Uses seedRssWithFallbacks with the most comprehensive feed
 * (Popular Mechanics cars feed as primary), falling back through
 * sitemap → Wayback CDX → homepage RSS autodiscovery.
 *
 * Run from repo root:
 *   node scripts/seed-cars-rss.mjs
 *   node scripts/seed-cars-rss.mjs --no-cache
 *
 * Category: GAMES_HOBBIES → CRAFTS_DIY_MAKING
 */

import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

// Primary: Popular Mechanics cars (DIY, repair, tools, maintenance)
await seedRssWithFallbacks({
  siteDomain: "popularmechanics.com",
  cacheFileName: "cars-rss.json",
  displayName: "🔧 Cars & DIY (Popular Mechanics)",
  feedUrl: "https://www.popularmechanics.com/rss/cars.xml",
  articlePathRegex: /\/(cars|technology|science|home|outdoors|military|space|flight|gear|auto)\//i,
  skipPaths: [
    /\/search\//, /\/about\//, /\/contact\//, /\/privacy\//, /\/terms\//,
    /\/subscribe\//, /\/newsletter\//, /\/rss\//, /\/account\//, /\/login\//,
    /\/register\//, /\/video\//, /\/gallery\//, /\/podcast\//, /\/store\//,
    /\/careers\//, /\/advertise\//, /\/tag\//, /\/author\//, /\/category\//,
    /\/page\//, /\/feed\//,
  ],
  siteSuffixRegex: /\s*\|\s*Popular Mechanics\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.CRAFTS_DIY_MAKING,
  source: "popularmechanics-cars",
  seeder_score: 0.65,
  maxArticles: 2000,
  maxPages: 20,
});