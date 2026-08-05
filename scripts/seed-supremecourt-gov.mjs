/**
 * seed-supremecourt-gov.mjs — Supreme Court seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.supremecourt.gov",
  cacheFileName: "supremecourt-gov.json",
  displayName: "🏛 Supreme Court",
  
  articlePathRegex: /(opinions|about)/,
  siteSuffixRegex: \s*[-–—]\s*supremecourt.gov\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "scotus-gov",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
