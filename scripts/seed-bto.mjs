/**
 * seed-bto.mjs — British Trust for Ornithology seeder
 * Scientific bird research, citizen science surveys, and avian ecology.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.bto.org",
  cacheFileName: "bto.json",
  displayName: "🐦 BTO",
  feedUrl: "https://www.bto.org/rss.xml",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*BTO\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "bto",
  seeder_score: 0.8,
  maxArticles: 2000,
  maxPages: 20,
});