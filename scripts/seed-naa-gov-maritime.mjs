/**
 * seed-naa-gov-maritime.mjs — NAA Maritime seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.naa.gov.au",
  cacheFileName: "naa-gov-maritime.json",
  displayName: "📜 NAA Maritime",
  
  articlePathRegex: /(explore-collection|research-your-family)/,
  siteSuffixRegex: \s*[-–—]\s*naa.gov.au\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "naa-maritime",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
