/**
 * seed-iheartdogs.mjs — iHeartDogs seeder
 * Dog health, rescue stories, nutrition tips, and product reviews.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "iheartdogs.com",
  cacheFileName: "iheartdogs.json",
  displayName: "❤️ iHeartDogs",
  feedUrl: "https://iheartdogs.com/feed",
  articlePathRegex: /\/[a-z0-9-]+\/$/i,
  siteSuffixRegex: /[-–—]\s*iHeartDogs\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "iheartdogs",
  seeder_score: 0.65,
  maxArticles: 1000,
  maxPages: 10,
});