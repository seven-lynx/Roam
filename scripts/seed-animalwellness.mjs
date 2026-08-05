/**
 * seed-animalwellness.mjs — Animal Wellness Magazine seeder
 * Holistic pet health, natural nutrition, and wellness articles.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "animalwellnessmagazine.com",
  cacheFileName: "animalwellness.json",
  displayName: "🌿 Animal Wellness",
  feedUrl: "https://animalwellnessmagazine.com/feed",
  articlePathRegex: /\/[a-z0-9-]+\/$/i,
  siteSuffixRegex: /\s*[-–—]\s*Animal Wellness Magazine\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "animalwellness",
  seeder_score: 0.65,
  maxArticles: 1000,
  maxPages: 10,
});