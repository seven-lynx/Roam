/**
 * seed-realclimate.mjs — RealClimate seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.realclimate.org",
  cacheFileName: "realclimate.json",
  displayName: "🌍 RealClimate",
  feedUrl: "https://www.realclimate.org/feed/",
  articlePathRegex: /index.php/archives/,
  siteSuffixRegex: \s*[-–—]\s*realclimate.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "realclimate",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
