/**
 * seed-monsterlibrary.mjs — Monster Library seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.monsterlibrary.org",
  cacheFileName: "monsterlibrary.json",
  displayName: "📚 Monster Library",
  
  articlePathRegex: /(creatures|articles)/,
  siteSuffixRegex: \s*[-–—]\s*monsterlibrary.org\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "monsterlibrary",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
