/**
 * seed-shc-edu.mjs — SHC seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.shc.education",
  cacheFileName: "shc-edu.json",
  displayName: "📚 SHC",
  
  articlePathRegex: /(resources|articles)/,
  siteSuffixRegex: \s*[-–—]\s*shc.education\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "shc",
  seeder_score: 0.45,
  maxArticles: 500,
  maxPages: 20,
});
