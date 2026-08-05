/**
 * seed-shadowlands.mjs — The Shadowlands seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.theshadowlands.net",
  cacheFileName: "shadowlands.json",
  displayName: "👻 The Shadowlands",
  
  articlePathRegex: /(creatures|places)/,
  siteSuffixRegex: \s*[-–—]\s*theshadowlands.net\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "shadowlands",
  seeder_score: 0.45,
  maxArticles: 500,
  maxPages: 20,
});
