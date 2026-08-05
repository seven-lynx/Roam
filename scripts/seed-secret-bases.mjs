/**
 * seed-secret-bases.mjs — Secret Bases seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.secret-bases.co.uk",
  cacheFileName: "secret-bases.json",
  displayName: "🏰 Secret Bases",
  
  articlePathRegex: /([a-z-]+)/,
  siteSuffixRegex: \s*[-–—]\s*secret-bases.co.uk\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "secret-bases",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
