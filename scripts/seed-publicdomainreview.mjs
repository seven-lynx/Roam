/**
 * seed-publicdomainreview.mjs — Public Domain Review seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "publicdomainreview.org",
  cacheFileName: "publicdomainreview.json",
  displayName: "📜 Public Domain Review",
  feedUrl: "https://publicdomainreview.org/feed/",
  articlePathRegex: /(essay|collection|feature)/,
  siteSuffixRegex: \s*[-–—]\s*publicdomainreview.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "pdr",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
