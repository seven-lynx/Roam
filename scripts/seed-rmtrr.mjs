/**
 * seed-rmtrr.mjs — Rocky Mountain TRR seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.rmtrr.org",
  cacheFileName: "rmtrr.json",
  displayName: "🏔 Rocky Mountain TRR",
  
  articlePathRegex: /(trails|news|about)/,
  siteSuffixRegex: \s*[-–—]\s*rmtrr.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "rmtrr",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
