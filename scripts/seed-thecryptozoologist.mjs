/**
 * seed-thecryptozoologist.mjs — The Cryptozoologist seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.thecryptozoologist.weebly.com",
  cacheFileName: "thecryptozoologist.json",
  displayName: "🔍 The Cryptozoologist",
  
  articlePathRegex: /(blog|cryptids)/,
  siteSuffixRegex: \s*[-–—]\s*thecryptozoologist.weebly.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "thecryptozoologist",
  seeder_score: 0.4,
  maxArticles: 500,
  maxPages: 20,
});
