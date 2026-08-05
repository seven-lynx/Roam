/**
 * seed-whoi-climate.mjs — WHOI Climate seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.whoi.edu",
  cacheFileName: "whoi-climate.json",
  displayName: "🌊 WHOI Climate",
  feedUrl: "https://www.whoi.edu/who-we-are/media-relations/news-releases/feed/",
  articlePathRegex: /(news-release|oceanus)/,
  siteSuffixRegex: \s*[-–—]\s*whoi.edu\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "whoi-climate",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
