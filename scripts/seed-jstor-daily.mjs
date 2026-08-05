/**
 * seed-jstor-daily.mjs — JSTOR Daily seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "daily.jstor.org",
  cacheFileName: "jstor-daily.json",
  displayName: "📚 JSTOR Daily",
  feedUrl: "https://daily.jstor.org/feed/",
  articlePathRegex: /([a-z0-9-]+-)+/,
  siteSuffixRegex: \s*[-–—]\s*daily.jstor.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "jstor-daily",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
