/**
 * seed-british-caving.mjs — British Caving seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.british-caving.org.uk",
  cacheFileName: "british-caving.json",
  displayName: "🇬🇧 British Caving",
  
  articlePathRegex: /(news|conservation|about)/,
  siteSuffixRegex: \s*[-–—]\s*british-caving.org.uk\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "british-caving",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
