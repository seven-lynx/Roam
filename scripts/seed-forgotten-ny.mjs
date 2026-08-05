/**
 * seed-forgotten-ny.mjs — Forgotten NY seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "forgotten-ny.com",
  cacheFileName: "forgotten-ny.json",
  displayName: "🗽 Forgotten NY",
  feedUrl: "https://forgotten-ny.com/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*forgotten-ny.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "forgotten-ny",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
