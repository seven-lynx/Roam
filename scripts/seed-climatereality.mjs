/**
 * seed-climatereality.mjs — Climate Reality seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.climaterealityproject.org",
  cacheFileName: "climatereality.json",
  displayName: "🌐 Climate Reality",
  feedUrl: "https://www.climaterealityproject.org/feed",
  articlePathRegex: /(blog|news)/,
  siteSuffixRegex: \s*[-–—]\s*climaterealityproject.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "climatereality",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
