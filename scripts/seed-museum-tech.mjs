/**
 * seed-museum-tech.mjs — Museum of Technology seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.museumoftechnology.org.uk",
  cacheFileName: "museum-tech.json",
  displayName: "🏛 Museum of Technology",
  
  articlePathRegex: /(history|exhibits|collections)/,
  siteSuffixRegex: \s*[-–—]\s*museumoftechnology.org.uk\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "museum-tech",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
