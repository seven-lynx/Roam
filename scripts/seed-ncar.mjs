/**
 * seed-ncar.mjs — NCAR seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "news.ucar.edu",
  cacheFileName: "ncar.json",
  displayName: "🌪 NCAR",
  feedUrl: "https://news.ucar.edu/feed",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*news.ucar.edu\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "ncar",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
