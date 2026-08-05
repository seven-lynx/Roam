/**
 * seed-themountaineer.mjs — The Mountaineer seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.mountaineers.org",
  cacheFileName: "themountaineer.json",
  displayName: "⛏ The Mountaineer",
  feedUrl: "https://www.mountaineers.org/blog/feed/",
  articlePathRegex: /(blog|activities|about)/,
  siteSuffixRegex: \s*[-–—]\s*mountaineers.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "themountaineer",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
