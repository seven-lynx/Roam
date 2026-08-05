/**
 * seed-mysticseaport.mjs — Mystic Seaport seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "mysticseaport.org",
  cacheFileName: "mysticseaport.json",
  displayName: "⚓ Mystic Seaport",
  
  articlePathRegex: /(explore|news|events)/,
  siteSuffixRegex: \s*[-–—]\s*mysticseaport.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "mysticseaport",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
