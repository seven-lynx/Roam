/**
 * seed-defenseofplants.mjs — In Defense of Plants seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.indefenseofplants.com",
  cacheFileName: "defenseofplants.json",
  displayName: "🌵 In Defense of Plants",
  feedUrl: "https://www.indefenseofplants.com/blog?format=rss",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*indefenseofplants.com\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "indefenseofplants",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
