/**
 * seed-metoffice.mjs — UK Met Office seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.metoffice.gov.uk",
  cacheFileName: "metoffice.json",
  displayName: "🌦 UK Met Office",
  feedUrl: "https://www.metoffice.gov.uk/about-us/press-office/news/weather-and-climate/feed",
  articlePathRegex: /about-us/,
  siteSuffixRegex: \s*[-–—]\s*metoffice.gov.uk\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "metoffice",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
