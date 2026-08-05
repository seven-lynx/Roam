/**
 * seed-bunkerdave.mjs — Bunker Dave seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.bunkerdave.com",
  cacheFileName: "bunkerdave.json",
  displayName: "☢ Bunker Dave",
  
  articlePathRegex: /(bunkers|articles|about)/,
  siteSuffixRegex: \s*[-–—]\s*bunkerdave.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "bunkerdave",
  seeder_score: 0.45,
  maxArticles: 500,
  maxPages: 20,
});
