/**
 * seed-carnivorous-plants.mjs — Carnivorous Plants seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.carnivorousplants.org",
  cacheFileName: "carnivorous-plants.json",
  displayName: "🌿 Carnivorous Plants",
  feedUrl: "https://www.carnivorousplants.org/feed/",
  articlePathRegex: /(news|events|articles)/,
  siteSuffixRegex: \s*[-–—]\s*carnivorousplants.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "carnivorousplants",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
