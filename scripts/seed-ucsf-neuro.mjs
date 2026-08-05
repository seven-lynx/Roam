/**
 * seed-ucsf-neuro.mjs — UCSF Neuroscience seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "neuroscience.ucsf.edu",
  cacheFileName: "ucsf-neuro.json",
  displayName: "🏥 UCSF Neuroscience",
  
  articlePathRegex: /(news|research|education)/,
  siteSuffixRegex: \s*[-–—]\s*neuroscience.ucsf.edu\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "ucsf-neuro",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
