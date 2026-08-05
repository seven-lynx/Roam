/**
 * seed-oceana.mjs — Oceana seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "oceana.org",
  cacheFileName: "oceana.json",
  displayName: "🐠 Oceana",
  feedUrl: "https://oceana.org/feed/",
  articlePathRegex: /(blog|reports|campaign)/,
  siteSuffixRegex: \s*[-–—]\s*oceana.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "oceana",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
