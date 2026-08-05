/**
 * seed-sprinting-air.mjs — Sprinting On Air seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.sprintingonair.com",
  cacheFileName: "sprinting-air.json",
  displayName: "🏃 Sprinting On Air",
  
  articlePathRegex: /(articles|blog|about)/,
  siteSuffixRegex: \s*[-–—]\s*sprintingonair.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "sprinting-air",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
