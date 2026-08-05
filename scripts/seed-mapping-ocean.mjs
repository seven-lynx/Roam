/**
 * seed-mapping-ocean.mjs — Mapping the Ocean seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.mappingtheocean.org",
  cacheFileName: "mapping-ocean.json",
  displayName: "🗺 Mapping the Ocean",
  
  articlePathRegex: /(news|projects|resources)/,
  siteSuffixRegex: \s*[-–—]\s*mappingtheocean.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "mapping-ocean",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
