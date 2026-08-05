/**
 * seed-newanimal.mjs — New Animal seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.newanimal.org",
  cacheFileName: "newanimal.json",
  displayName: "🐾 New Animal",
  
  articlePathRegex: /(articles|creatures)/,
  siteSuffixRegex: \s*[-–—]\s*newanimal.org\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "newanimal",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
