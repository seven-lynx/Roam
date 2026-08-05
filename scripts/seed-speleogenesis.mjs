/**
 * seed-speleogenesis.mjs — Speleogenesis seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.speleogenesis.info",
  cacheFileName: "speleogenesis.json",
  displayName: "🕳 Speleogenesis",
  
  articlePathRegex: /(news|journal|articles)/,
  siteSuffixRegex: \s*[-–—]\s*speleogenesis.info\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "speleogenesis",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
