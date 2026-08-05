/**
 * seed-shipwrecklog.mjs — Shipwreck Log seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.shipwrecklog.com",
  cacheFileName: "shipwrecklog.json",
  displayName: "🛳 Shipwreck Log",
  feedUrl: "https://www.shipwrecklog.com/feed/",
  articlePathRegex: /(log|news)/,
  siteSuffixRegex: \s*[-–—]\s*shipwrecklog.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "shipwrecklog",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
