/**
 * seed-yale-law-school.mjs — Yale Law School seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "law.yale.edu",
  cacheFileName: "yale-law-school.json",
  displayName: "🎓 Yale Law School",
  
  articlePathRegex: /(news|events|student-life)/,
  siteSuffixRegex: \s*[-–—]\s*law.yale.edu\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "yale-law",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
