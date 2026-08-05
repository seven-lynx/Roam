/**
 * seed-conifers-org.mjs — Conifers.org seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.conifers.org",
  cacheFileName: "conifers-org.json",
  displayName: "🌲 Conifers.org",
  
  articlePathRegex: /(topics|ar)/,
  siteSuffixRegex: \s*[-–—]\s*conifers.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "conifers-org",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
