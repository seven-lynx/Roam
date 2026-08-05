/**
 * seed-desert-archaeology.mjs — Desert Archaeology seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.desertarchaeology.org",
  cacheFileName: "desert-archaeology.json",
  displayName: "🏺 Desert Archaeology",
  
  articlePathRegex: /(projects|news|about)/,
  siteSuffixRegex: \s*[-–—]\s*desertarchaeology.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "desert-archaeology",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
