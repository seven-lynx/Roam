/**
 * seed-forteansociety.mjs — The Fortean Society seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.forteansociety.org",
  cacheFileName: "forteansociety.json",
  displayName: "🔍 The Fortean Society",
  
  articlePathRegex: /(news|essays|resources)/,
  siteSuffixRegex: \s*[-–—]\s*forteansociety.org\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "forteansociety",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
