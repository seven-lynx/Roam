/**
 * seed-mariners-museum.mjs — Mariners Museum seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.marinersmuseum.org",
  cacheFileName: "mariners-museum.json",
  displayName: "⚓ Mariners Museum",
  
  articlePathRegex: /(explore|collections|news)/,
  siteSuffixRegex: \s*[-–—]\s*marinersmuseum.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "mariners-museum",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
