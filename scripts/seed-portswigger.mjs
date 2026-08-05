/**
 * seed-portswigger.mjs — PortSwigger Research seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "portswigger.net",
  cacheFileName: "portswigger.json",
  displayName: "🔬 PortSwigger Research",
  feedUrl: "https://portswigger.net/daily-swig/rss",
  articlePathRegex: /(daily-swig|research)/,
  siteSuffixRegex: \s*[-–—]\s*portswigger.net\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "portswigger",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
