/**
 * seed-alpinist.mjs — Alpinist seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.alpinist.com",
  cacheFileName: "alpinist.json",
  displayName: "⛏ Alpinist",
  feedUrl: "https://www.alpinist.com/feed/",
  articlePathRegex: /(newswire|features|climbing-life)/,
  siteSuffixRegex: \s*[-–—]\s*alpinist.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "alpinist",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
