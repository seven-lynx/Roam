/**
 * seed-mythical-creatures-guide.mjs — Mythical Creatures Guide seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.mythicalcreaturesguide.com",
  cacheFileName: "mythical-creatures-guide.json",
  displayName: "📖 Mythical Creatures Guide",
  
  articlePathRegex: /([a-z-]+)/,
  siteSuffixRegex: \s*[-–—]\s*mythicalcreaturesguide.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "mythicalcreatures",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
