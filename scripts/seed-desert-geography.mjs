/**
 * seed-desert-geography.mjs — Desert Geography seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.desertgeography.com",
  cacheFileName: "desert-geography.json",
  displayName: "🗺 Desert Geography",
  
  articlePathRegex: /(articles|maps|about)/,
  siteSuffixRegex: \s*[-–—]\s*desertgeography.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "desert-geography",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
