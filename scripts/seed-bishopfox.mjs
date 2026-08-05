/**
 * seed-bishopfox.mjs — Bishop Fox seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "bishopfox.com",
  cacheFileName: "bishopfox.json",
  displayName: "🦊 Bishop Fox",
  feedUrl: "https://bishopfox.com/blog/rss.xml",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*bishopfox.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "bishopfox",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
