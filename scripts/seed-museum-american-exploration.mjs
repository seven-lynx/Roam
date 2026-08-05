/**
 * seed-museum-american-exploration.mjs — Museum of American Exploration seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.lewisexploration.org",
  cacheFileName: "museum-american-exploration.json",
  displayName: "🏛 Museum of American Exploration",
  
  articlePathRegex: /(history|collections|news)/,
  siteSuffixRegex: \s*[-–—]\s*lewisexploration.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "lewis-exploration",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
