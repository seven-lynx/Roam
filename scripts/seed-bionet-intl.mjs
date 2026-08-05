/**
 * seed-bionet-intl.mjs — Bionet Intl seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.bionet-intl.org",
  cacheFileName: "bionet-intl.json",
  displayName: "🌍 Bionet Intl",
  
  articlePathRegex: /(news|resources|publications)/,
  siteSuffixRegex: \s*[-–—]\s*bionet-intl.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "bionet-intl",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
