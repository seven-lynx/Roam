/**
 * seed-nps-mountains.mjs — NPS Mountains seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.nps.gov",
  cacheFileName: "nps-mountains.json",
  displayName: "🏔 NPS Mountains",
  
  articlePathRegex: /(subjects|park)[a-z-]*/mountain/,
  siteSuffixRegex: \s*[-–—]\s*nps.gov\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "nps-mountains",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
