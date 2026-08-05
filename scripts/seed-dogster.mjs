/**
 * seed-dogster.mjs — Dogster seeder
 * Dog health, behavior, breeds, and lifestyle content.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.dogster.com",
  cacheFileName: "dogster.json",
  displayName: "🐶 Dogster",
  feedUrl: "https://www.dogster.com/feed",
  articlePathRegex: /\/[a-z0-9-]+\/$/i,
  siteSuffixRegex: /[-–—]\s*Dogster\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "dogster",
  seeder_score: 0.65,
  maxArticles: 1000,
  maxPages: 10,
});