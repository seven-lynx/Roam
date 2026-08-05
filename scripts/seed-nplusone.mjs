/**
 * seed-nplusone.mjs — n+1 Magazine seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.nplusonemag.com",
  cacheFileName: "nplusone.json",
  displayName: "📖 n+1 Magazine",
  feedUrl: "https://www.nplusonemag.com/feed/",
  articlePathRegex: /issue/,
  siteSuffixRegex: \s*[-–—]\s*nplusonemag.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "nplusone",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
