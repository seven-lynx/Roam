/**
 * seed-cold-deserts.mjs — Cold Deserts seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.colddeserts.org",
  cacheFileName: "cold-deserts.json",
  displayName: "❄ Cold Deserts",
  
  articlePathRegex: /(about|gallery|articles)/,
  siteSuffixRegex: \s*[-–—]\s*colddeserts.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "cold-deserts",
  seeder_score: 0.45,
  maxArticles: 500,
  maxPages: 20,
});
