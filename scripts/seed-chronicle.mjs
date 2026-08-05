/**
 * seed-chronicle.mjs — Chronicle of Higher Ed seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.chronicle.com",
  cacheFileName: "chronicle.json",
  displayName: "🎓 Chronicle of Higher Ed",
  feedUrl: "https://www.chronicle.com/feed/",
  articlePathRegex: /(article|feature)/,
  siteSuffixRegex: \s*[-–—]\s*chronicle.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "chronicle",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
