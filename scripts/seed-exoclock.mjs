/**
 * seed-exoclock.mjs — ExoClock seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.exoclock.space",
  cacheFileName: "exoclock.json",
  displayName: "⏱ ExoClock",
  
  articlePathRegex: /(news|targets)/,
  siteSuffixRegex: \s*[-–—]\s*exoclock.space\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "exoclock",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
