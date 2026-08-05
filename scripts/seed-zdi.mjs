/**
 * seed-zdi.mjs — Zero Day Initiative seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.zerodayinitiative.com",
  cacheFileName: "zdi.json",
  displayName: "🎯 Zero Day Initiative",
  feedUrl: "https://www.zerodayinitiative.com/blog?format=rss",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*zerodayinitiative.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "zdi",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
