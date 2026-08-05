/**
 * seed-parisreview.mjs — The Paris Review seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.theparisreview.org",
  cacheFileName: "parisreview.json",
  displayName: "📖 The Paris Review",
  feedUrl: "https://www.theparisreview.org/blog/feed/",
  articlePathRegex: /(blog|interviews)/,
  siteSuffixRegex: \s*[-–—]\s*theparisreview.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "parisreview",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
