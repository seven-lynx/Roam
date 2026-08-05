/**
 * seed-discoverfrance.mjs — Discover France seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.discoverfrance.net",
  cacheFileName: "discoverfrance.json",
  displayName: "🇫🇷 Discover France",
  
  articlePathRegex: /(France|Colonies)/,
  siteSuffixRegex: \s*[-–—]\s*discoverfrance.net\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "discoverfrance",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
