/**
 * seed-nasa-ame.mjs — NASA AME seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.nasa.gov",
  cacheFileName: "nasa-ame.json",
  displayName: "🪐 NASA AME",
  feedUrl: "https://www.nasa.gov/subject/7530/astrobiology/feed/",
  articlePathRegex: /,
  siteSuffixRegex: \s*[-–—]\s*nasa.gov\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "nasa-ame",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
