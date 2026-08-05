/**
 * seed-mbari.mjs — MBARI seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.mbari.org",
  cacheFileName: "mbari.json",
  displayName: "🤖 MBARI",
  feedUrl: "https://www.mbari.org/feed/",
  articlePathRegex: /(news|research|data)/,
  siteSuffixRegex: \s*[-–—]\s*mbari.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "mbari",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
