/**
 * seed-catster.mjs — Catster seeder
 * Cat health, behavior, breeds, and lifestyle content.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.catster.com",
  cacheFileName: "catster.json",
  displayName: "🐱 Catster",
  feedUrl: "https://www.catster.com/feed",
  articlePathRegex: /\/[a-z0-9-]+\/$/i,
  siteSuffixRegex: /[-–—]\s*Catster\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "catster",
  seeder_score: 0.65,
  maxArticles: 1000,
  maxPages: 10,
});