/**
 * seed-thedodo.mjs — The Dodo seeder
 * Animal rescue stories, pet care, wildlife features.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.thedodo.com",
  cacheFileName: "thedodo.json",
  displayName: "🐾 The Dodo",
  feedUrl: "https://www.thedodo.com/feed",
  articlePathRegex: /\/[a-z0-9-]+(?:\/\d+)?\/?$/i,
  siteSuffixRegex: /[-–—]\s*The Dodo\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "thedodo",
  seeder_score: 0.7,
  maxArticles: 1000,
  maxPages: 10,
});