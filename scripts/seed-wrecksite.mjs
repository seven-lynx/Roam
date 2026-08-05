/**
 * seed-wrecksite.mjs — Wrecksite seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.wrecksite.eu",
  cacheFileName: "wrecksite.json",
  displayName: "🚢 Wrecksite",
  
  articlePathRegex: /(wreck|about)/,
  siteSuffixRegex: \s*[-–—]\s*wrecksite.eu\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "wrecksite",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
