/**
 * seed-nexss.mjs — NExSS seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "nexusfordata.org",
  cacheFileName: "nexss.json",
  displayName: "🔬 NExSS",
  
  articlePathRegex: /./,
  siteSuffixRegex: \s*[-–—]\s*nexusfordata.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "nexss",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
