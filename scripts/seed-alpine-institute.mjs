/**
 * seed-alpine-institute.mjs — Alpine Institute seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.alpineinstitute.com",
  cacheFileName: "alpine-institute.json",
  displayName: "⛏ Alpine Institute",
  feedUrl: "https://www.alpineinstitute.com/feed/",
  articlePathRegex: /(blog|programs|about)/,
  siteSuffixRegex: \s*[-–—]\s*alpineinstitute.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "alpine-institute",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
