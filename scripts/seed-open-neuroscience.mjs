/**
 * seed-open-neuroscience.mjs — Open Neuroscience seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.open-neuroscience.com",
  cacheFileName: "open-neuroscience.json",
  displayName: "🔓 Open Neuroscience",
  
  articlePathRegex: /(post|data|software)/,
  siteSuffixRegex: \s*[-–—]\s*open-neuroscience.com\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "open-neuroscience",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
