/**
 * seed-mountainplanet.mjs — Mountain Planet seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "mountainplanet.com",
  cacheFileName: "mountainplanet.json",
  displayName: "🌏 Mountain Planet",
  
  articlePathRegex: /(mountains|routes|expeditions)/,
  siteSuffixRegex: \s*[-–—]\s*mountainplanet.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "mountainplanet",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
