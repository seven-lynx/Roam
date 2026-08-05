/**
 * seed-sierranevada.mjs — Sierra Nevada seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.sierranevada.geol.ucsb.edu",
  cacheFileName: "sierranevada.json",
  displayName: "🏔 Sierra Nevada",
  
  articlePathRegex: /(research|about|resources)/,
  siteSuffixRegex: \s*[-–—]\s*sierranevada.geol.ucsb.edu\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "sierranevada",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
