/**
 * seed-nasa-history.mjs — NASA History seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "history.nasa.gov",
  cacheFileName: "nasa-history.json",
  displayName: "🚀 NASA History",
  
  articlePathRegex: /(spdocs|publications|topics)/,
  siteSuffixRegex: \s*[-–—]\s*history.nasa.gov\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "nasa-history",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
