/**
 * seed-nautiluslive.mjs — Nautilus Live seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "nautiluslive.org",
  cacheFileName: "nautiluslive.json",
  displayName: "🌊 Nautilus Live",
  feedUrl: "https://nautiluslive.org/feeds/all",
  articlePathRegex: /(blog|expedition|tech)/,
  siteSuffixRegex: \s*[-–—]\s*nautiluslive.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "nautiluslive",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
