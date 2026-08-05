/**
 * seed-laphams-quarterly.mjs — Lapham's Quarterly seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.laphamsquarterly.org",
  cacheFileName: "laphams-quarterly.json",
  displayName: "📖 Lapham's Quarterly",
  feedUrl: "https://www.laphamsquarterly.org/rss.xml",
  articlePathRegex: /(roundtable|essay|archive)/,
  siteSuffixRegex: \s*[-–—]\s*laphamsquarterly.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "laphamsquarterly",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
