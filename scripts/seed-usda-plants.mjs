/**
 * seed-usda-plants.mjs — USDA Plants seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "plants.usda.gov",
  cacheFileName: "usda-plants.json",
  displayName: "🌾 USDA Plants",
  
  articlePathRegex: /home/,
  siteSuffixRegex: \s*[-–—]\s*plants.usda.gov\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "usda-plants",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
