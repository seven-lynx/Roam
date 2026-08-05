/**
 * seed-bringatrailer.mjs — Bring a Trailer seeder
 * Collector car auction deep-dives with model history and specifications.
 * Category: GAMES_HOBBIES → COLLECTING
 * Access: RSS feed (WordPress) → Sitemap → Wayback
 *
 * Discovery tiers:
 *   1. RSS feed at /feed/ (WordPress — primary, confirmed working live)
 *   2. Sitemap fallback
 *   3. Wayback CDX fallback
 *   4. RSS autodiscovery from homepage
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "bringatrailer.com",
  cacheFileName: "bringatrailer.json",
  displayName: "🚗 Bring a Trailer",
  feedUrl: "https://bringatrailer.com/feed/",
  articlePathRegex: /\/(\d{4}\/\d{2}|listing|feature|article|news|auction)\//i,
  siteSuffixRegex: /\s*\|\s*(?:Bring a Trailer|BaT)\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.COLLECTING,
  source: "bringatrailer",
  seeder_score: 0.7,
  maxArticles: 2000,
  maxPages: 20,
});
