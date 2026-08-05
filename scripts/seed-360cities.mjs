/**
 * seed-360cities.mjs — 360Cities seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.360cities.net",
  cacheFileName: "360cities.json",
  displayName: "🌐 360Cities",
  feedUrl: "https://www.360cities.net/feed/",
  articlePathRegex: /(image|area|set)/,
  siteSuffixRegex: \s*[-–—]\s*360cities.net\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "360cities",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
