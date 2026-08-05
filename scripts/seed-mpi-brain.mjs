/**
 * seed-mpi-brain.mjs — MPI Brain seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "brain.mpg.de",
  cacheFileName: "mpi-brain.json",
  displayName: "🔬 MPI Brain",
  
  articlePathRegex: /(research|news|publications)/,
  siteSuffixRegex: \s*[-–—]\s*brain.mpg.de\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "mpi-brain",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
