/**
 * seed-350org.mjs — 350.org seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "350.org",
  cacheFileName: "350org.json",
  displayName: "🌍 350.org",
  feedUrl: "https://350.org/feed/",
  articlePathRegex: /(news|resources)/,
  siteSuffixRegex: \s*[-–—]\s*350.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "350org",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
