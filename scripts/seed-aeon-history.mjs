/**
 * seed-aeon-history.mjs — Aeon History seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "aeon.co",
  cacheFileName: "aeon-history.json",
  displayName: "📖 Aeon History",
  feedUrl: "https://aeon.co/feeds.rss",
  articlePathRegex: /(essays|ideas)/,
  siteSuffixRegex: \s*[-–—]\s*aeon.co\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "aeon-history",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
