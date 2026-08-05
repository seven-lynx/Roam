/**
 * seed-karstwaters.mjs — Karst Waters Institute seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.karstwaters.org",
  cacheFileName: "karstwaters.json",
  displayName: "💧 Karst Waters Institute",
  
  articlePathRegex: /(publications|news|about)/,
  siteSuffixRegex: \s*[-–—]\s*karstwaters.org\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "karstwaters",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
