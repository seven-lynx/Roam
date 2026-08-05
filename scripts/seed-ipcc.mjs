/**
 * seed-ipcc.mjs — IPCC seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.ipcc.ch",
  cacheFileName: "ipcc.json",
  displayName: "📘 IPCC",
  feedUrl: "https://www.ipcc.ch/feed/",
  articlePathRegex: /(report|news|documentation)/,
  siteSuffixRegex: \s*[-–—]\s*ipcc.ch\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "ipcc",
  seeder_score: 0.9,
  maxArticles: 500,
  maxPages: 20,
});
