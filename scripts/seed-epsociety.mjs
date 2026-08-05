/**
 * seed-epsociety.mjs — EPSociety seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.epsociety.org",
  cacheFileName: "epsociety.json",
  displayName: "📚 EPSociety",
  
  articlePathRegex: /(newsletter|resources)/,
  siteSuffixRegex: \s*[-–—]\s*epsociety.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "epsociety",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
