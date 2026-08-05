/**
 * seed-anomalist.mjs — Anomalist seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.anomalist.com",
  cacheFileName: "anomalist.json",
  displayName: "❓ Anomalist",
  feedUrl: "https://www.anomalist.com/feed.xml",
  articlePathRegex: /(report|features)/,
  siteSuffixRegex: \s*[-–—]\s*anomalist.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "anomalist",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
