/**
 * seed-ejiltalk.mjs — EJIL:Talk! seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.ejiltalk.org",
  cacheFileName: "ejiltalk.json",
  displayName: "🌐 EJIL:Talk!",
  feedUrl: "https://www.ejiltalk.org/feed/",
  articlePathRegex: /([a-z0-9-]+-)+/,
  siteSuffixRegex: \s*[-–—]\s*ejiltalk.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "ejiltalk",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
