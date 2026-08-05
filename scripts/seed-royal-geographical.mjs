/**
 * seed-royal-geographical.mjs — Royal Geographical Society seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.rgs.org",
  cacheFileName: "royal-geographical.json",
  displayName: "🌍 Royal Geographical Society",
  feedUrl: "https://www.rgs.org/feed/",
  articlePathRegex: /(about|news|research)/,
  siteSuffixRegex: \s*[-–—]\s*rgs.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "rgs",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
