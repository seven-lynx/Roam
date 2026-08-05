/**
 * seed-lamont.mjs — Lamont-Doherty seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "lamont.columbia.edu",
  cacheFileName: "lamont.json",
  displayName: "🌎 Lamont-Doherty",
  feedUrl: "https://lamont.columbia.edu/rss.xml",
  articlePathRegex: /(news|research|events)/,
  siteSuffixRegex: \s*[-–—]\s*lamont.columbia.edu\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "lamont",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
