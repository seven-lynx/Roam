/**
 * seed-tyndall.mjs — Tyndall Centre seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.tyndall.ac.uk",
  cacheFileName: "tyndall.json",
  displayName: "🏴 Tyndall Centre",
  feedUrl: "https://www.tyndall.ac.uk/feed",
  articlePathRegex: /(news|research|publications)/,
  siteSuffixRegex: \s*[-–—]\s*tyndall.ac.uk\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "tyndall",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
