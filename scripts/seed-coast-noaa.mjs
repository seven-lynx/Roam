/**
 * seed-coast-noaa.mjs — NOAA Coast seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "coast.noaa.gov",
  cacheFileName: "coast-noaa.json",
  displayName: "🏖 NOAA Coast",
  
  articlePathRegex: /(digitalcoast|topics|data)/,
  siteSuffixRegex: \s*[-–—]\s*coast.noaa.gov\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "coast-noaa",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
