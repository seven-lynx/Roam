/**
 * seed-rmg.mjs — Royal Museums Greenwich seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.rmg.co.uk",
  cacheFileName: "rmg.json",
  displayName: "⚓ Royal Museums Greenwich",
  feedUrl: "https://www.rmg.co.uk/rss.xml",
  articlePathRegex: /(stories|collections|whats-on)/,
  siteSuffixRegex: \s*[-–—]\s*rmg.co.uk\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "rmg",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
