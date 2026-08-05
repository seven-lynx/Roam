/**
 * seed-noaa-climate.mjs — NOAA Climate seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.noaa.gov",
  cacheFileName: "noaa-climate.json",
  displayName: "🐟 NOAA Climate",
  feedUrl: "https://www.noaa.gov/rss-feeds/climate",
  articlePathRegex: /(news|climate)/,
  siteSuffixRegex: \s*[-–—]\s*noaa.gov\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "noaa-climate",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
