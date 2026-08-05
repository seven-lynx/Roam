/**
 * seed-americanhiking.mjs — American Hiking Society seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "americanhiking.org",
  cacheFileName: "americanhiking.json",
  displayName: "🥾 American Hiking Society",
  feedUrl: "https://americanhiking.org/feed/",
  articlePathRegex: /(blog|resources|advocacy)/,
  siteSuffixRegex: \s*[-–—]\s*americanhiking.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "americanhiking",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
