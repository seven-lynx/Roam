/**
 * seed-colorado14ers.mjs — Colorado 14ers seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.14ers.com",
  cacheFileName: "colorado14ers.json",
  displayName: "🏔 Colorado 14ers",
  feedUrl: "https://www.14ers.com/feed/",
  articlePathRegex: /(php14ers|tripreport|peak)/,
  siteSuffixRegex: \s*[-–—]\s*14ers.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "14ers",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
