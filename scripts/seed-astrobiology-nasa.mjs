/**
 * seed-astrobiology-nasa.mjs — NASA Astrobiology seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "astrobiology.nasa.gov",
  cacheFileName: "astrobiology-nasa.json",
  displayName: "🪐 NASA Astrobiology",
  feedUrl: "https://astrobiology.nasa.gov/feed/",
  articlePathRegex: /(news|articles|about)/,
  siteSuffixRegex: \s*[-–—]\s*astrobiology.nasa.gov\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "astrobiology-nasa",
  seeder_score: 0.9,
  maxArticles: 500,
  maxPages: 20,
});
