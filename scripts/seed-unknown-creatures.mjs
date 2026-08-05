/**
 * seed-unknown-creatures.mjs — Unknown Creatures seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.unknown-creatures.com",
  cacheFileName: "unknown-creatures.json",
  displayName: "❓ Unknown Creatures",
  
  articlePathRegex: /(sightings|research|about)/,
  siteSuffixRegex: \s*[-–—]\s*unknown-creatures.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "unknown-creatures",
  seeder_score: 0.45,
  maxArticles: 500,
  maxPages: 20,
});
