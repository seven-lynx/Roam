/**
 * seed-australian-desert.mjs — Australian Desert seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.australiandesert.com",
  cacheFileName: "australian-desert.json",
  displayName: "🏜 Australian Desert",
  
  articlePathRegex: /(facts|animals|plants)/,
  siteSuffixRegex: \s*[-–—]\s*australiandesert.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "australian-desert",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
