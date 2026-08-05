/**
 * seed-yukon-news.mjs — Yukon News Archives seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.yukon-news.com",
  cacheFileName: "yukon-news.json",
  displayName: "🏔 Yukon News Archives",
  feedUrl: "https://www.yukon-news.com/feed/",
  articlePathRegex: /(news|opinion|sports)/,
  siteSuffixRegex: \s*[-–—]\s*yukon-news.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "yukon-news",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
