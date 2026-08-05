/**
 * seed-cryptomundo.mjs — Cryptomundo seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "cryptomundo.com",
  cacheFileName: "cryptomundo.json",
  displayName: "🐲 Cryptomundo",
  feedUrl: "https://cryptomundo.com/feed/",
  articlePathRegex: /(cryptozoology|breaking-news)/,
  siteSuffixRegex: \s*[-–—]\s*cryptomundo.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "cryptomundo",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
