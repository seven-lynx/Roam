/**
 * seed-bats.mjs — Bat Conservation Trust seeder
 * Bat ecology, conservation science, and public engagement with chiroptera.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.bats.org.uk",
  cacheFileName: "bats.json",
  displayName: "🦇 Bat Conservation Trust",
  feedUrl: "https://www.bats.org.uk/news/feed",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*Bat Conservation Trust\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "bats",
  seeder_score: 0.7,
  maxArticles: 2000,
  maxPages: 20,
});