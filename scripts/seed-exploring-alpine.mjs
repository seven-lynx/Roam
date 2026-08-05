/**
 * seed-exploring-alpine.mjs — Exploring Alpine seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.exploringalpine.com",
  cacheFileName: "exploring-alpine.json",
  displayName: "🏔 Exploring Alpine",
  feedUrl: "https://www.exploringalpine.com/feed/",
  articlePathRegex: /(blog|trip-reports|resources)/,
  siteSuffixRegex: \s*[-–—]\s*exploringalpine.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "exploring-alpine",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
