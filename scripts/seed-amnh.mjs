/**
 * seed-amnh.mjs — American Museum of Natural History seeder
 * Exhibitions, research, and natural history collections.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.amnh.org",
  cacheFileName: "amnh.json",
  displayName: "🦕 AMNH",
  feedUrl: "https://www.amnh.org/explore/news-blogs/feed",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*AMNH\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "amnh",
  seeder_score: 0.8,
  maxArticles: 2000,
  maxPages: 20,
});