/**
 * seed-forteana.mjs — Forteana seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.forteana.org",
  cacheFileName: "forteana.json",
  displayName: "👽 Forteana",
  
  articlePathRegex: /(html|articles)/,
  siteSuffixRegex: \s*[-–—]\s*forteana.org\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "forteana",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
