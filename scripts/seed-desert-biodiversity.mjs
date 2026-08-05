/**
 * seed-desert-biodiversity.mjs — Desert Biodiversity seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.desertbiodiversity.org",
  cacheFileName: "desert-biodiversity.json",
  displayName: "🌵 Desert Biodiversity",
  
  articlePathRegex: /(plants|animals|about)/,
  siteSuffixRegex: \s*[-–—]\s*desertbiodiversity.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "desert-biodiversity",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
