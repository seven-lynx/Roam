/**
 * seed-oyez.mjs — Oyez seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.oyez.org",
  cacheFileName: "oyez.json",
  displayName: "📜 Oyez",
  
  articlePathRegex: /(cases|justices)/,
  siteSuffixRegex: \s*[-–—]\s*oyez.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "oyez",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
