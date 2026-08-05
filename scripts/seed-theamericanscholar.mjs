/**
 * seed-theamericanscholar.mjs — The American Scholar seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "theamericanscholar.org",
  cacheFileName: "theamericanscholar.json",
  displayName: "📚 The American Scholar",
  feedUrl: "https://theamericanscholar.org/feed/",
  articlePathRegex: /([a-z0-9-]+-)+/,
  siteSuffixRegex: \s*[-–—]\s*theamericanscholar.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "americanscholar",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
