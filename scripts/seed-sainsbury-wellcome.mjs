/**
 * seed-sainsbury-wellcome.mjs — SWC seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.sainsburywellcome.org",
  cacheFileName: "sainsbury-wellcome.json",
  displayName: "🇬🇧 SWC",
  
  articlePathRegex: /(research|news|publications)/,
  siteSuffixRegex: \s*[-–—]\s*sainsburywellcome.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "sainsbury-wellcome",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
