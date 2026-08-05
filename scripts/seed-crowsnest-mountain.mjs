/**
 * seed-crowsnest-mountain.mjs — Crowsnest Mountain seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.crowsnestmountainwild.ca",
  cacheFileName: "crowsnest-mountain.json",
  displayName: "🏔 Crowsnest Mountain",
  
  articlePathRegex: /(trails|wildlife|about)/,
  siteSuffixRegex: \s*[-–—]\s*crowsnestmountainwild.ca\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "crowsnest",
  seeder_score: 0.45,
  maxArticles: 500,
  maxPages: 20,
});
