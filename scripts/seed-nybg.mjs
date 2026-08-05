/**
 * seed-nybg.mjs — NYBG seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.nybg.org",
  cacheFileName: "nybg.json",
  displayName: "🌷 NYBG",
  feedUrl: "https://www.nybg.org/feed/",
  articlePathRegex: /(blogs|events|collections)/,
  siteSuffixRegex: \s*[-–—]\s*nybg.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "nybg",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
