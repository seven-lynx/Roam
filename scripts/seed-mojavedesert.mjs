/**
 * seed-mojavedesert.mjs — Mojave Desert seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.mojavedesert.net",
  cacheFileName: "mojavedesert.json",
  displayName: "🏜 Mojave Desert",
  
  articlePathRegex: /(plants|animals|geology)/,
  siteSuffixRegex: \s*[-–—]\s*mojavedesert.net\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "mojavedesert",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
