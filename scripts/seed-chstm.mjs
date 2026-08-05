/**
 * seed-chstm.mjs — CHSTM seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.chstm.org",
  cacheFileName: "chstm.json",
  displayName: "📚 CHSTM",
  feedUrl: "https://www.chstm.org/feed",
  articlePathRegex: /(content|publications)/,
  siteSuffixRegex: \s*[-–—]\s*chstm.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "chstm",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
