/**
 * seed-sandboarding.mjs — Sandboarding seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.sand-boarding.com",
  cacheFileName: "sandboarding.json",
  displayName: "🏂 Sandboarding",
  
  articlePathRegex: /(locations|guides|news)/,
  siteSuffixRegex: \s*[-–—]\s*sand-boarding.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "sandboarding",
  seeder_score: 0.45,
  maxArticles: 500,
  maxPages: 20,
});
