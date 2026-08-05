/**
 * seed-ieeeghn.mjs — IEEE Engineering History seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "ethw.org",
  cacheFileName: "ieeeghn.json",
  displayName: "⚡ IEEE Engineering History",
  
  articlePathRegex: /(Milestones|Archives)/,
  siteSuffixRegex: \s*[-–—]\s*ethw.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "ieeeghn",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
