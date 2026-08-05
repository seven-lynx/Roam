/**
 * seed-tess-mit.mjs — TESS MIT seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "tess.mit.edu",
  cacheFileName: "tess-mit.json",
  displayName: "🛰 TESS MIT",
  feedUrl: "https://tess.mit.edu/feed/",
  articlePathRegex: /(news|publications|events)/,
  siteSuffixRegex: \s*[-–—]\s*tess.mit.edu\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "tess-mit",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
