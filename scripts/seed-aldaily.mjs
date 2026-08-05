/**
 * seed-aldaily.mjs — Arts & Letters Daily seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.aldaily.com",
  cacheFileName: "aldaily.json",
  displayName: "📚 Arts & Letters Daily",
  
  articlePathRegex: /(articles|essays)/,
  siteSuffixRegex: \s*[-–—]\s*aldaily.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "aldaily",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
