/**
 * seed-jwst.mjs — JWST seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "webb.nasa.gov",
  cacheFileName: "jwst.json",
  displayName: "🔭 JWST",
  feedUrl: "https://webb.nasa.gov/feed/",
  articlePathRegex: /(news|content)/,
  siteSuffixRegex: \s*[-–—]\s*webb.nasa.gov\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "jwst",
  seeder_score: 0.9,
  maxArticles: 500,
  maxPages: 20,
});
