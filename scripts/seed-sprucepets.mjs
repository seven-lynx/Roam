/**
 * seed-sprucepets.mjs — The Spruce Pets seeder
 * Expert dog and cat care, breed guides, training, and nutrition.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.thesprucepets.com",
  cacheFileName: "sprucepets.json",
  displayName: "🌿 The Spruce Pets",
  feedUrl: "https://www.thesprucepets.com/feed",
  articlePathRegex: /\/[a-z0-9-]+(?:\d+)?\/(?:\d+\/)?$/i,
  siteSuffixRegex: /[-–—]\s*The Spruce Pets\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "sprucepets",
  seeder_score: 0.7,
  maxArticles: 1000,
  maxPages: 10,
});