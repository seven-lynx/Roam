/**
 * seed-historyofcomputing.mjs — History of Computing seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.historyofcomputing.net",
  cacheFileName: "historyofcomputing.json",
  displayName: "💻 History of Computing",
  
  articlePathRegex: /(timeline|people|machines)/,
  siteSuffixRegex: \s*[-–—]\s*historyofcomputing.net\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "historyofcomputing",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
