/**
 * seed-4000metres.mjs — 4000 Metres seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.4000metres.com",
  cacheFileName: "4000metres.json",
  displayName: "⛏ 4000 Metres",
  
  articlePathRegex: /(trips|articles|gallery)/,
  siteSuffixRegex: \s*[-–—]\s*4000metres.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "4000metres",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
