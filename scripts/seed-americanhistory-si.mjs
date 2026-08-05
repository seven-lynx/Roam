/**
 * seed-americanhistory-si.mjs — American History Museum seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "americanhistory.si.edu",
  cacheFileName: "americanhistory-si.json",
  displayName: "🏛 American History Museum",
  feedUrl: "https://americanhistory.si.edu/feed",
  articlePathRegex: /(blog|collections|exhibitions)/,
  siteSuffixRegex: \s*[-–—]\s*americanhistory.si.edu\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "amhistory-si",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
