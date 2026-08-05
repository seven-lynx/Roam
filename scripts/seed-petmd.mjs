/**
 * seed-petmd.mjs — PetMD seeder
 * Veterinary-reviewed pet health, nutrition, and care advice.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.petmd.com",
  cacheFileName: "petmd.json",
  displayName: "🏥 PetMD",
  feedUrl: "https://www.petmd.com/rss",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+(\/\d+)?\/?$/i,
  siteSuffixRegex: /[-–—]\s*PetMD\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "petmd",
  seeder_score: 0.75,
  maxArticles: 1000,
  maxPages: 10,
});