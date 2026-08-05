/**
 * seed-acshist.mjs — ACS History of Chemistry seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "acshist.scs.illinois.edu",
  cacheFileName: "acshist.json",
  displayName: "🎓 ACS History of Chemistry",
  
  articlePathRegex: /(newsletter|resources)/,
  siteSuffixRegex: \s*[-–—]\s*acshist.scs.illinois.edu\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "acshist",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
