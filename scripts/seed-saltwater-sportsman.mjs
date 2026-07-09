/**
 * seed-saltwater-sportsman.mjs — Saltwater Sportsman seeder
 * Offshore and inshore saltwater fishing, boats, gear, and techniques.
 * Category: GAMES_HOBBIES → FISHING
 * Multi-method: RSS → Sitemap → Wayback → RSS Auto
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.saltwatersportsman.com",
  cacheFileName: "saltwater-sportsman.json",
  displayName: "🐟 Saltwater Sportsman",
  feedUrl: "https://www.saltwatersportsman.com/feed/",
  articlePathRegex: /\/(fishing|boats|gear|techniques|species|conservation|travel)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[\|\-]\s*Salt\s*Water\s*Sportsman\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.FISHING,
  source: "saltwater-sportsman",
  seeder_score: 0.8,
  maxArticles: 1500,
  maxPages: 20,
});