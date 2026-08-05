/**
 * seed-schneier.mjs — Schneier on Security seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.schneier.com",
  cacheFileName: "schneier.json",
  displayName: "🔐 Schneier on Security",
  feedUrl: "https://www.schneier.com/feed/atom/",
  articlePathRegex: /blog/archives/,
  siteSuffixRegex: \s*[-–—]\s*schneier.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "schneier",
  seeder_score: 0.9,
  maxArticles: 500,
  maxPages: 20,
});
