/**
 * seed-msrc.mjs — MSRC seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "msrc.microsoft.com",
  cacheFileName: "msrc.json",
  displayName: "🪟 MSRC",
  feedUrl: "https://msrc.microsoft.com/blog/feed/",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*msrc.microsoft.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "msrc",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
