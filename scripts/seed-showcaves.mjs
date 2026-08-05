/**
 * seed-showcaves.mjs — Show Caves seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.showcaves.com",
  cacheFileName: "showcaves.json",
  displayName: "🕳 Show Caves",
  
  articlePathRegex: /(english|region)/,
  siteSuffixRegex: \s*[-–—]\s*showcaves.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "showcaves",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
