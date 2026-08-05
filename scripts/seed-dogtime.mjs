/**
 * seed-dogtime.mjs — DogTime seeder
 * Dog breed information, adoption guides, training, and health tips.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "dogtime.com",
  cacheFileName: "dogtime.json",
  displayName: "🐕 DogTime",
  feedUrl: "https://dogtime.com/feed",
  articlePathRegex: /\/[a-z0-9-]+\/$/i,
  siteSuffixRegex: /[-–—]\s*DogTime\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "dogtime",
  seeder_score: 0.65,
  maxArticles: 1000,
  maxPages: 10,
});