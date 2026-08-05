/**
 * seed-the-plant-list.mjs — The Plant List seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.theplantlist.org",
  cacheFileName: "the-plant-list.json",
  displayName: "📋 The Plant List",
  
  articlePathRegex: /,
  siteSuffixRegex: \s*[-–—]\s*theplantlist.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "the-plant-list",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
