/**
 * seed-volokh.mjs — Volokh Conspiracy seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "reason.com",
  cacheFileName: "volokh.json",
  displayName: "📰 Volokh Conspiracy",
  feedUrl: "https://reason.com/volokh/feed/",
  articlePathRegex: /volokh/,
  siteSuffixRegex: \s*[-–—]\s*reason.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "volokh",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
