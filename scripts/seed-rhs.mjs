/**
 * seed-rhs.mjs — RHS seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.rhs.org.uk",
  cacheFileName: "rhs.json",
  displayName: "🌻 RHS",
  feedUrl: "https://www.rhs.org.uk/feed",
  articlePathRegex: /(plants|gardening|science)/,
  siteSuffixRegex: \s*[-–—]\s*rhs.org.uk\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "rhs",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
