/**
 * seed-scott-polar.mjs — Scott Polar Research Institute seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.spri.cam.ac.uk",
  cacheFileName: "scott-polar.json",
  displayName: "❄ Scott Polar Research Institute",
  feedUrl: "https://www.spri.cam.ac.uk/news/feed/",
  articlePathRegex: /(news|museum|research)/,
  siteSuffixRegex: \s*[-–—]\s*spri.cam.ac.uk\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "scott-polar",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
