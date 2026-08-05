/**
 * seed-bgci.mjs — BGCI seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.bgci.org",
  cacheFileName: "bgci.json",
  displayName: "🌱 BGCI",
  feedUrl: "https://www.bgci.org/feed/",
  articlePathRegex: /(news|resources)/,
  siteSuffixRegex: \s*[-–—]\s*bgci.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "bgci",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
