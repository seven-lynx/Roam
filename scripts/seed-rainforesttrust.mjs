/**
 * seed-rainforesttrust.mjs — Rainforest Trust seeder
 * Habitat conservation, endangered species protection, and tropical ecology.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.rainforesttrust.org",
  cacheFileName: "rainforesttrust.json",
  displayName: "🌴 Rainforest Trust",
  feedUrl: "https://www.rainforesttrust.org/feed",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*Rainforest Trust\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "rainforesttrust",
  seeder_score: 0.75,
  maxArticles: 2000,
  maxPages: 20,
});