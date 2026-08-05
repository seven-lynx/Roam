/**
 * seed-iacr.mjs — IACR seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.iacr.org",
  cacheFileName: "iacr.json",
  displayName: "🔑 IACR",
  feedUrl: "https://iacr.org/feed.xml",
  articlePathRegex: /(news|tools|publications)/,
  siteSuffixRegex: \s*[-–—]\s*iacr.org\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "iacr",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
