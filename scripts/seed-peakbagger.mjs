/**
 * seed-peakbagger.mjs — Peakbagger seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.peakbagger.com",
  cacheFileName: "peakbagger.json",
  displayName: "🏔 Peakbagger",
  
  articlePathRegex: /(list|peak|range)/,
  siteSuffixRegex: \s*[-–—]\s*peakbagger.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "peakbagger",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
