/**
 * seed-forteantimes.mjs — Fortean Times seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.forteantimes.com",
  cacheFileName: "forteantimes.json",
  displayName: "📰 Fortean Times",
  feedUrl: "https://www.forteantimes.com/feed",
  articlePathRegex: /(articles|news|features)/,
  siteSuffixRegex: \s*[-–—]\s*forteantimes.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "forteantimes",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
