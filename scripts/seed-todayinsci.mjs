/**
 * seed-todayinsci.mjs — Today in Science History seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.todayinsci.com",
  cacheFileName: "todayinsci.json",
  displayName: "📅 Today in Science History",
  
  articlePathRegex: /d+/,
  siteSuffixRegex: \s*[-–—]\s*todayinsci.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "todayinsci",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
