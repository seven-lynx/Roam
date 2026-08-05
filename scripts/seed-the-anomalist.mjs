/**
 * seed-the-anomalist.mjs — The Anomalist Daily seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "theanomalist.com",
  cacheFileName: "the-anomalist.json",
  displayName: "📰 The Anomalist Daily",
  
  articlePathRegex: /(daily|articles)/,
  siteSuffixRegex: \s*[-–—]\s*theanomalist.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "the-anomalist",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
