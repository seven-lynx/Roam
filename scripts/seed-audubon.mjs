/**
 * seed-audubon.mjs — Audubon Society seeder
 * Bird conservation, identification guides, and environmental journalism.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.audubon.org",
  cacheFileName: "audubon.json",
  displayName: "🐦 Audubon",
  feedUrl: "https://www.audubon.org/rss",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*Audubon\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "audubon",
  seeder_score: 0.75,
  maxArticles: 2000,
  maxPages: 20,
});