/**
 * seed-wildsnow.mjs — WildSnow seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.wildsnow.com",
  cacheFileName: "wildsnow.json",
  displayName: "⛷ WildSnow",
  feedUrl: "https://www.wildsnow.com/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*wildsnow.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "wildsnow",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
