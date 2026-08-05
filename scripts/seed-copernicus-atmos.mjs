/**
 * seed-copernicus-atmos.mjs — Copernicus Atmosphere seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "atmosphere.copernicus.eu",
  cacheFileName: "copernicus-atmos.json",
  displayName: "🛰 Copernicus Atmosphere",
  feedUrl: "https://atmosphere.copernicus.eu/rss.xml",
  articlePathRegex: /(news|data|about)/,
  siteSuffixRegex: \s*[-–—]\s*atmosphere.copernicus.eu\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "copernicus-atmos",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
