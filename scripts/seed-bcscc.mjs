/**
 * seed-bcscc.mjs — BC Scientific Cryptozoology seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.bcscc.ca",
  cacheFileName: "bcscc.json",
  displayName: "🐻 BC Scientific Cryptozoology",
  
  articlePathRegex: /(sightings|research|about)/,
  siteSuffixRegex: \s*[-–—]\s*bcscc.ca\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "bcscc",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
