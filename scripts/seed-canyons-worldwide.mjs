/**
 * seed-canyons-worldwide.mjs — Canyons Worldwide seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.canyonsworldwide.com",
  cacheFileName: "canyons-worldwide.json",
  displayName: "🏜 Canyons Worldwide",
  
  articlePathRegex: /(canyons|articles|gallery)/,
  siteSuffixRegex: \s*[-–—]\s*canyonsworldwide.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "canyons-worldwide",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
