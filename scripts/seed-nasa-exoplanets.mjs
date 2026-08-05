/**
 * seed-nasa-exoplanets.mjs — NASA Exoplanets seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "exoplanets.nasa.gov",
  cacheFileName: "nasa-exoplanets.json",
  displayName: "🔭 NASA Exoplanets",
  feedUrl: "https://exoplanets.nasa.gov/feed/",
  articlePathRegex: /(news|blog|resources)/,
  siteSuffixRegex: \s*[-–—]\s*exoplanets.nasa.gov\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "nasa-exoplanets",
  seeder_score: 0.9,
  maxArticles: 500,
  maxPages: 20,
});
