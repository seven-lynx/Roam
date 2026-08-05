/**
 * seed-desert-ecology-au.mjs — Desert Ecology Australia seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.desertecology.com.au",
  cacheFileName: "desert-ecology-au.json",
  displayName: "🏜 Desert Ecology Australia",
  
  articlePathRegex: /(research|news|about)/,
  siteSuffixRegex: \s*[-–—]\s*desertecology.com.au\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "desert-ecology-au",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
