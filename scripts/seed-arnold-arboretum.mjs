/**
 * seed-arnold-arboretum.mjs — Arnold Arboretum seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "arnoldarboretum.org",
  cacheFileName: "arnold-arboretum.json",
  displayName: "🌳 Arnold Arboretum",
  feedUrl: "https://arboretum.harvard.edu/feed/",
  articlePathRegex: /(plants|stories|research)/,
  siteSuffixRegex: \s*[-–—]\s*arnoldarboretum.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "arnold-arboretum",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
