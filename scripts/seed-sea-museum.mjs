/**
 * seed-sea-museum.mjs — Australian National Maritime Museum seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.sea.museum",
  cacheFileName: "sea-museum.json",
  displayName: "⚓ Australian National Maritime Museum",
  feedUrl: "https://www.sea.museum/feed",
  articlePathRegex: /(whats-on|stories|collections)/,
  siteSuffixRegex: \s*[-–—]\s*sea.museum\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "sea-museum",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
