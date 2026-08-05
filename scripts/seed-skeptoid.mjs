/**
 * seed-skeptoid.mjs — Skeptoid seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "skeptoid.com",
  cacheFileName: "skeptoid.json",
  displayName: "🔍 Skeptoid",
  feedUrl: "https://skeptoid.com/feeds/audio",
  articlePathRegex: /episodes/,
  siteSuffixRegex: \s*[-–—]\s*skeptoid.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "skeptoid",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
