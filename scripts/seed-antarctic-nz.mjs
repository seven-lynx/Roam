/**
 * seed-antarctic-nz.mjs — Antarctic Heritage NZ seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "nzaht.org",
  cacheFileName: "antarctic-nz.json",
  displayName: "❄ Antarctic Heritage NZ",
  feedUrl: "https://nzaht.org/feed/",
  articlePathRegex: /(conservation|news|explore)/,
  siteSuffixRegex: \s*[-–—]\s*nzaht.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "antarctic-nz",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
