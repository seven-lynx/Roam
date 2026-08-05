/**
 * seed-centennialofflight.mjs — Centennial of Flight seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.centennialofflight.net",
  cacheFileName: "centennialofflight.json",
  displayName: "✈ Centennial of Flight",
  
  articlePathRegex: /(essay|history)/,
  siteSuffixRegex: \s*[-–—]\s*centennialofflight.net\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "centennialofflight",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
