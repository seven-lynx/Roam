/**
 * seed-nccgroup.mjs — NCC Group seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "research.nccgroup.com",
  cacheFileName: "nccgroup.json",
  displayName: "🔓 NCC Group",
  feedUrl: "https://research.nccgroup.com/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*research.nccgroup.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "nccgroup",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
