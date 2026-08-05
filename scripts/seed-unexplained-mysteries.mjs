/**
 * seed-unexplained-mysteries.mjs — Unexplained Mysteries seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.unexplained-mysteries.com",
  cacheFileName: "unexplained-mysteries.json",
  displayName: "❓ Unexplained Mysteries",
  feedUrl: "https://www.unexplained-mysteries.com/feed/",
  articlePathRegex: /(news|forum)/,
  siteSuffixRegex: \s*[-–—]\s*unexplained-mysteries.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "unexplained-mysteries",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
