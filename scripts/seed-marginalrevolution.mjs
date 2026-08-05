/**
 * seed-marginalrevolution.mjs — Marginal Revolution seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "marginalrevolution.com",
  cacheFileName: "marginalrevolution.json",
  displayName: "📊 Marginal Revolution",
  feedUrl: "https://marginalrevolution.com/feed",
  articlePathRegex: /([a-z0-9-]+-)+/,
  siteSuffixRegex: \s*[-–—]\s*marginalrevolution.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "marginalrevolution",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
