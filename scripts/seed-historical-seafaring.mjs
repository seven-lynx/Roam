/**
 * seed-historical-seafaring.mjs — Historical Seafaring seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.historicalseafaring.org",
  cacheFileName: "historical-seafaring.json",
  displayName: "⛵ Historical Seafaring",
  
  articlePathRegex: /(articles|resources|about)/,
  siteSuffixRegex: \s*[-–—]\s*historicalseafaring.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "historical-seafaring",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
