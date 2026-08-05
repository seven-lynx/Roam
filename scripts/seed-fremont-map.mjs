/**
 * seed-fremont-map.mjs — Fremonts Map seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.fremontsmap.com",
  cacheFileName: "fremont-map.json",
  displayName: "🗺 Fremonts Map",
  
  articlePathRegex: /(maps|history|explore)/,
  siteSuffixRegex: \s*[-–—]\s*fremontsmap.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "fremont-map",
  seeder_score: 0.45,
  maxArticles: 500,
  maxPages: 20,
});
