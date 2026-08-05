/**
 * seed-cabinetmagazine.mjs — Cabinet Magazine seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.cabinetmagazine.org",
  cacheFileName: "cabinetmagazine.json",
  displayName: "📚 Cabinet Magazine",
  
  articlePathRegex: /(issues|kiosk)/,
  siteSuffixRegex: \s*[-–—]\s*cabinetmagazine.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "cabinetmagazine",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
