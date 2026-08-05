/**
 * seed-project-zero.mjs — Project Zero seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "googleprojectzero.blogspot.com",
  cacheFileName: "project-zero.json",
  displayName: "🔍 Project Zero",
  feedUrl: "https://googleprojectzero.blogspot.com/feeds/posts/default",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*googleprojectzero.blogspot.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "project-zero",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
