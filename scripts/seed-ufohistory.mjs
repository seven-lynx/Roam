/**
 * seed-ufohistory.mjs — UFO History seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.ufohistory.com",
  cacheFileName: "ufohistory.json",
  displayName: "🛸 UFO History",
  
  articlePathRegex: /(ufos|timeline|articles)/,
  siteSuffixRegex: \s*[-–—]\s*ufohistory.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "ufohistory",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
