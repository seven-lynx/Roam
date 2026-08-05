/**
 * seed-worldfloraonline.mjs — World Flora Online seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.worldfloraonline.org",
  cacheFileName: "worldfloraonline.json",
  displayName: "🌐 World Flora Online",
  
  articlePathRegex: /(taxon|about)/,
  siteSuffixRegex: \s*[-–—]\s*worldfloraonline.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "worldfloraonline",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
