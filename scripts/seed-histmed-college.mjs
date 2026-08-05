/**
 * seed-histmed-college.mjs — Historical Medical Library seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "histmed.collegeofphysicians.org",
  cacheFileName: "histmed-college.json",
  displayName: "🏥 Historical Medical Library",
  
  articlePathRegex: /(news|collections|digital)/,
  siteSuffixRegex: \s*[-–—]\s*histmed.collegeofphysicians.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "histmed",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
