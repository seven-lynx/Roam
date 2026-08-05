/**
 * seed-scotusblog.mjs — SCOTUSblog seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.scotusblog.com",
  cacheFileName: "scotusblog.json",
  displayName: "⚖ SCOTUSblog",
  feedUrl: "https://www.scotusblog.com/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*scotusblog.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "scotusblog",
  seeder_score: 0.9,
  maxArticles: 500,
  maxPages: 20,
});
