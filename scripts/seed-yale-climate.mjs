/**
 * seed-yale-climate.mjs — Yale Climate Connections seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "yaleclimateconnections.org",
  cacheFileName: "yale-climate.json",
  displayName: "🌳 Yale Climate Connections",
  feedUrl: "https://yaleclimateconnections.org/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*yaleclimateconnections.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "yale-climate",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
