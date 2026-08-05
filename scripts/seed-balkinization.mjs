/**
 * seed-balkinization.mjs — Balkinization seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "balkin.blogspot.com",
  cacheFileName: "balkinization.json",
  displayName: "📝 Balkinization",
  feedUrl: "https://balkin.blogspot.com/feeds/posts/default",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*balkin.blogspot.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "balkinization",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
