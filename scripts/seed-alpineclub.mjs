/**
 * seed-alpineclub.mjs — American Alpine Club seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.americanalpineclub.org",
  cacheFileName: "alpineclub.json",
  displayName: "⛏ American Alpine Club",
  feedUrl: "https://www.americanalpineclub.org/feed/",
  articlePathRegex: /(news|publications|library)/,
  siteSuffixRegex: \s*[-–—]\s*americanalpineclub.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "alpineclub",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
