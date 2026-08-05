/**
 * seed-rstm.mjs — RSTM seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.rstm.org",
  cacheFileName: "rstm.json",
  displayName: "📖 RSTM",
  
  articlePathRegex: /(news|publications)/,
  siteSuffixRegex: \s*[-–—]\s*rstm.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "rstm",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
