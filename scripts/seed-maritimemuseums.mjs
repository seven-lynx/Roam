/**
 * seed-maritimemuseums.mjs — Maritime Museums seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.maritimemuseums.org",
  cacheFileName: "maritimemuseums.json",
  displayName: "⚓ Maritime Museums",
  
  articlePathRegex: /(museums|news|events)/,
  siteSuffixRegex: \s*[-–—]\s*maritimemuseums.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "maritimemuseums",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
