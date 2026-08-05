/**
 * seed-hunt-botanical.mjs — Hunt Botanical seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.huntbotanical.org",
  cacheFileName: "hunt-botanical.json",
  displayName: "🌿 Hunt Botanical",
  
  articlePathRegex: /(collections|exhibitions)/,
  siteSuffixRegex: \s*[-–—]\s*huntbotanical.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "hunt-botanical",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
