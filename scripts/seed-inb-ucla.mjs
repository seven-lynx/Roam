/**
 * seed-inb-ucla.mjs — UCLA INB seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.bri.ucla.edu",
  cacheFileName: "inb-ucla.json",
  displayName: "🎓 UCLA INB",
  
  articlePathRegex: /(news|research|education)/,
  siteSuffixRegex: \s*[-–—]\s*bri.ucla.edu\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "inb-ucla",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
