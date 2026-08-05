/**
 * seed-vintage-maps.mjs — Vintage Map Shop seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.thevintagemapshop.com",
  cacheFileName: "vintage-maps.json",
  displayName: "🗺 Vintage Map Shop",
  
  articlePathRegex: /(product|blog)/,
  siteSuffixRegex: \s*[-–—]\s*thevintagemapshop.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "vintage-maps",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
