/**
 * seed-botanical-online.mjs — Botanical Online seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.botanical-online.com",
  cacheFileName: "botanical-online.json",
  displayName: "🌿 Botanical Online",
  feedUrl: "https://www.botanical-online.com/feed/",
  articlePathRegex: /(las-plantas|propiedades|medicinales)/,
  siteSuffixRegex: \s*[-–—]\s*botanical-online.com\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "botanical-online",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
