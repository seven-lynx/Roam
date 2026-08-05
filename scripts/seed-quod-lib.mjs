/**
 * seed-quod-lib.mjs — Quod Lib seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "quod.lib.umich.edu",
  cacheFileName: "quod-lib.json",
  displayName: "📚 Quod Lib",
  
  articlePathRegex: /(cgi|text|t)/,
  siteSuffixRegex: \s*[-–—]\s*quod.lib.umich.edu\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "quod-lib",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
