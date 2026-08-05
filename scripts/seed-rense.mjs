/**
 * seed-rense.mjs — Rense seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.rense.com",
  cacheFileName: "rense.json",
  displayName: "📡 Rense",
  
  articlePathRegex: /(general|whatsnew)/,
  siteSuffixRegex: \s*[-–—]\s*rense.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "rense",
  seeder_score: 0.45,
  maxArticles: 500,
  maxPages: 20,
});
