/**
 * seed-scripps.mjs — Scripps seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "scripps.ucsd.edu",
  cacheFileName: "scripps.json",
  displayName: "🌊 Scripps",
  feedUrl: "https://scripps.ucsd.edu/news/feed",
  articlePathRegex: /(news|research|about)/,
  siteSuffixRegex: \s*[-–—]\s*scripps.ucsd.edu\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "scripps",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
