/**
 * seed-carbonbrief.mjs — Carbon Brief seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.carbonbrief.org",
  cacheFileName: "carbonbrief.json",
  displayName: "⚡ Carbon Brief",
  feedUrl: "https://www.carbonbrief.org/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*carbonbrief.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "carbonbrief",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
