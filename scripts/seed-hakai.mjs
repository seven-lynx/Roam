/**
 * seed-hakai.mjs — Hakai Magazine seeder
 * Coastal ecology, marine biology, and ocean wildlife longform journalism.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "hakaimagazine.com",
  cacheFileName: "hakai.json",
  displayName: "🌊 Hakai Magazine",
  feedUrl: "https://hakaimagazine.com/feed",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*Hakai Magazine\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "hakai",
  seeder_score: 0.8,
  maxArticles: 2000,
  maxPages: 20,
});