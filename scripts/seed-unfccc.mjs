/**
 * seed-unfccc.mjs — UNFCCC seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "unfccc.int",
  cacheFileName: "unfccc.json",
  displayName: "🇺🇳 UNFCCC",
  feedUrl: "https://unfccc.int/rss.xml",
  articlePathRegex: /(news|process-and-meetings|topics)/,
  siteSuffixRegex: \s*[-–—]\s*unfccc.int\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "unfccc",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
