/**
 * seed-sciencehistory.mjs — Science History Institute seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.sciencehistory.org",
  cacheFileName: "sciencehistory.json",
  displayName: "⚗ Science History Institute",
  feedUrl: "https://www.sciencehistory.org/feed/",
  articlePathRegex: /(stories|collections|about)/,
  siteSuffixRegex: \s*[-–—]\s*sciencehistory.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "sciencehistory",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
