/**
 * seed-underground-history.mjs — Underground History seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.underground-history.com",
  cacheFileName: "underground-history.json",
  displayName: "🏚 Underground History",
  
  articlePathRegex: /(history|locations|articles)/,
  siteSuffixRegex: \s*[-–—]\s*underground-history.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "underground-history",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
