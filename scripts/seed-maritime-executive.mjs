/**
 * seed-maritime-executive.mjs — Maritime Executive seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.maritime-executive.com",
  cacheFileName: "maritime-executive.json",
  displayName: "🚢 Maritime Executive",
  feedUrl: "https://www.maritime-executive.com/rss",
  articlePathRegex: /(article|news)/,
  siteSuffixRegex: \s*[-–—]\s*maritime-executive.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "maritime-executive",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
