/**
 * seed-climate-gov.mjs — Climate.gov seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.climate.gov",
  cacheFileName: "climate-gov.json",
  displayName: "🌡 Climate.gov",
  feedUrl: "https://www.climate.gov/rss.xml",
  articlePathRegex: /(news-features|teaching|data)/,
  siteSuffixRegex: \s*[-–—]\s*climate.gov\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "climate-gov",
  seeder_score: 0.95,
  maxArticles: 500,
  maxPages: 20,
});
