/**
 * seed-climatecentral.mjs — Climate Central seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.climatecentral.org",
  cacheFileName: "climatecentral.json",
  displayName: "📊 Climate Central",
  feedUrl: "https://www.climatecentral.org/feed",
  articlePathRegex: /(news|research|climate-matters)/,
  siteSuffixRegex: \s*[-–—]\s*climatecentral.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "climatecentral",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
