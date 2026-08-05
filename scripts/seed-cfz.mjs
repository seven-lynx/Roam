/**
 * seed-cfz.mjs — CFZ seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.cfz.org.uk",
  cacheFileName: "cfz.json",
  displayName: "🔍 CFZ",
  
  articlePathRegex: /(news|publications|about)/,
  siteSuffixRegex: \s*[-–—]\s*cfz.org.uk\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "cfz",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
