/**
 * seed-nsidc.mjs — NSIDC seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "nsidc.org",
  cacheFileName: "nsidc.json",
  displayName: "❄ NSIDC",
  feedUrl: "https://nsidc.org/feed",
  articlePathRegex: /(news|data|arcticseaicenews)/,
  siteSuffixRegex: \s*[-–—]\s*nsidc.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "nsidc",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
