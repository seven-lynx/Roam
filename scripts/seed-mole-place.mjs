/**
 * seed-mole-place.mjs — Mole Place seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.moleplace.com",
  cacheFileName: "mole-place.json",
  displayName: "🔻 Mole Place",
  
  articlePathRegex: /(underground|articles|history)/,
  siteSuffixRegex: \s*[-–—]\s*moleplace.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "mole-place",
  seeder_score: 0.45,
  maxArticles: 500,
  maxPages: 20,
});
