/**
 * seed-qualys.mjs — Qualys seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "blog.qualys.com",
  cacheFileName: "qualys.json",
  displayName: "🔎 Qualys",
  feedUrl: "https://blog.qualys.com/feed/",
  articlePathRegex: /(vulnerabilities-threat-research|product-tech)/,
  siteSuffixRegex: \s*[-–—]\s*blog.qualys.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "qualys",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
