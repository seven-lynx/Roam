/**
 * seed-sub-urban.mjs — Sub-Urban seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.sub-urban.org",
  cacheFileName: "sub-urban.json",
  displayName: "🏙 Sub-Urban",
  
  articlePathRegex: /(projects|publications|about)/,
  siteSuffixRegex: \s*[-–—]\s*sub-urban.org\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "sub-urban",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
