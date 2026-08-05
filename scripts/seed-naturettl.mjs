/**
 * seed-naturettl.mjs — Nature TTL seeder
 * Wildlife photography tutorials, field craft, and conservation photo essays.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.naturettl.com",
  cacheFileName: "naturettl.json",
  displayName: "📷 Nature TTL",
  feedUrl: "https://www.naturettl.com/feed",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*Nature TTL\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "naturettl",
  seeder_score: 0.75,
  maxArticles: 2000,
  maxPages: 20,
});