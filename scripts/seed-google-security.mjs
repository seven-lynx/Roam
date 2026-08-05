/**
 * seed-google-security.mjs — Google Security seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "security.googleblog.com",
  cacheFileName: "google-security.json",
  displayName: "🔐 Google Security",
  feedUrl: "https://security.googleblog.com/feeds/posts/default",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*security.googleblog.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "google-security",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
