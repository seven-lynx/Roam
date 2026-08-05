/**
 * seed-chesterzoo.mjs — Chester Zoo seeder (UK)
 * Zoo conservation science, species breeding programs, and animal care.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.chesterzoo.org",
  cacheFileName: "chesterzoo.json",
  displayName: "🦁 Chester Zoo",
  feedUrl: "https://www.chesterzoo.org/news/feed",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*Chester Zoo\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "chesterzoo",
  seeder_score: 0.75,
  maxArticles: 2000,
  maxPages: 20,
});