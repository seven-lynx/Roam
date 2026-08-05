/**
 * seed-cropcircleconnector.mjs — Crop Circle Connector seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.cropcircleconnector.com",
  cacheFileName: "cropcircleconnector.json",
  displayName: "🌾 Crop Circle Connector",
  
  articlePathRegex: /(anasearch|inter|intro)/,
  siteSuffixRegex: \s*[-–—]\s*cropcircleconnector.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "cropcircleconnector",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
