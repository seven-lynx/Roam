/**
 * seed-dailygrail.mjs — Daily Grail seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.dailygrail.com",
  cacheFileName: "dailygrail.json",
  displayName: "🏆 Daily Grail",
  feedUrl: "https://www.dailygrail.com/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*dailygrail.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "dailygrail",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
