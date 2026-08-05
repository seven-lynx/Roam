/**
 * seed-bspb.mjs — BSPB Plant Pathology seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.bspb.org",
  cacheFileName: "bspb.json",
  displayName: "🔬 BSPB Plant Pathology",
  feedUrl: "https://www.bspb.org/feed/",
  articlePathRegex: /(news|publications|events)/,
  siteSuffixRegex: \s*[-–—]\s*bspb.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "bspb",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
