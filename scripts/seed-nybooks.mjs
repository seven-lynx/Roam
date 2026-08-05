/**
 * seed-nybooks.mjs — NY Review of Books seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.nybooks.com",
  cacheFileName: "nybooks.json",
  displayName: "📚 NY Review of Books",
  feedUrl: "https://www.nybooks.com/feed/",
  articlePathRegex: /(articles|online)/,
  siteSuffixRegex: \s*[-–—]\s*nybooks.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "nybooks",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
