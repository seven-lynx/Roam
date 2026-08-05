/**
 * seed-allaboutbirds.mjs — All About Birds seeder (Cornell Lab)
 * Bird identification guides, behavior articles, and live bird cam highlights.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.allaboutbirds.org",
  cacheFileName: "allaboutbirds.json",
  displayName: "🐦 All About Birds",
  feedUrl: "https://www.allaboutbirds.org/news/feed",
  articlePathRegex: /\/news\/[a-z0-9-]+\/$/i,
  siteSuffixRegex: /\s*[-–—]\s*All About Birds\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "allaboutbirds",
  seeder_score: 0.75,
  maxArticles: 1000,
  maxPages: 10,
});