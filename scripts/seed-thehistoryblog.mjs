/**
 * seed-thehistoryblog.mjs — The History Blog seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.thehistoryblog.com",
  cacheFileName: "thehistoryblog.json",
  displayName: "📖 The History Blog",
  feedUrl: "https://www.thehistoryblog.com/feed",
  articlePathRegex: /archives/,
  siteSuffixRegex: \s*[-–—]\s*thehistoryblog.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "thehistoryblog",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
