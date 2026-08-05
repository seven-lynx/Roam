/**
 * seed-cryptography-engineering.mjs — Crypto Engineering seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "blog.cryptographyengineering.com",
  cacheFileName: "cryptography-engineering.json",
  displayName: "🔐 Crypto Engineering",
  feedUrl: "https://blog.cryptographyengineering.com/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*blog.cryptographyengineering.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "cryptography-engineering",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
