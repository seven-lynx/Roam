/**
 * seed-atlasobscura-food.mjs — Atlas Obscura Gastro Obscura seeder
 * Global food customs, culinary traditions, unusual food stories.
 * Category: PEOPLE_PLACES → FESTIVALS_CUSTOMS
 * Multi-method: RSS → Sitemap → Wayback CDX
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.atlasobscura.com",
  cacheFileName: "atlasobscura-food.json",
  displayName: "🍽️ Atlas Obscura — Gastro Obscura",
  feedUrl: "https://www.atlasobscura.com/articles/feed/atom?category=foods",
  articlePathRegex: /\/foods\/[a-z0-9-]+|\/articles\/[a-z0-9-]+|\/articles\/[a-z0-9-]+/i,
  siteSuffixRegex: /[–\-|]\s*Atlas Obscura\s*$/i,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.FESTIVALS_CUSTOMS,
  source: "atlasobscura-food",
  seeder_score: 0.7,
});