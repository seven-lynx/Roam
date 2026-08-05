/**
 * seed-coldwarhistory.mjs — Cold War History seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.coldwarhistory.org",
  cacheFileName: "coldwarhistory.json",
  displayName: "☢ Cold War History",
  
  articlePathRegex: /(bunkers|articles|sites)/,
  siteSuffixRegex: \s*[-–—]\s*coldwarhistory.org\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "coldwarhistory",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
