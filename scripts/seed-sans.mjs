/**
 * seed-sans.mjs — SANS ISC seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "isc.sans.edu",
  cacheFileName: "sans.json",
  displayName: "🎓 SANS ISC",
  feedUrl: "https://isc.sans.edu/rssfeed_full.xml",
  articlePathRegex: /(diary|podcast|data)/,
  siteSuffixRegex: \s*[-–—]\s*isc.sans.edu\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "sans",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
