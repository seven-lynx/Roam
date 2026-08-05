/**
 * seed-lindbergh-foundation.mjs — Lindbergh Foundation seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.lindberghfoundation.org",
  cacheFileName: "lindbergh-foundation.json",
  displayName: "✈ Lindbergh Foundation",
  
  articlePathRegex: /(news|history|programs)/,
  siteSuffixRegex: \s*[-–—]\s*lindberghfoundation.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "lindbergh",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
