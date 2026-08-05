/**
 * seed-mountains-travel.mjs — Mountains Travel Photos seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.mountainsoftravelphotos.com",
  cacheFileName: "mountains-travel.json",
  displayName: "🏔 Mountains Travel Photos",
  
  articlePathRegex: /([A-Z][a-z]+[-])/,
  siteSuffixRegex: \s*[-–—]\s*mountainsoftravelphotos.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "mountain-photos",
  seeder_score: 0.45,
  maxArticles: 500,
  maxPages: 20,
});
