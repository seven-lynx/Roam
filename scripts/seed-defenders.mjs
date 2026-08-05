/**
 * seed-defenders.mjs — Defenders of Wildlife seeder
 * US wildlife conservation, endangered species advocacy, and habitat protection.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "defenders.org",
  cacheFileName: "defenders.json",
  displayName: "🐺 Defenders of Wildlife",
  feedUrl: "https://defenders.org/newsroom/newswire/feed",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*Defenders of Wildlife\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "defenders",
  seeder_score: 0.75,
  maxArticles: 2000,
  maxPages: 20,
});