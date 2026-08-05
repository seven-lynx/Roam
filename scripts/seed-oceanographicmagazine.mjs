/**
 * seed-oceanographicmagazine.mjs — Oceanographic Magazine seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.oceanographicmagazine.com",
  cacheFileName: "oceanographicmagazine.json",
  displayName: "📖 Oceanographic Magazine",
  feedUrl: "https://www.oceanographicmagazine.com/feed/",
  articlePathRegex: /(features|news|gallery)/,
  siteSuffixRegex: \s*[-–—]\s*oceanographicmagazine.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "oceanographicmagazine",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
