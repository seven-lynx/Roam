/**
 * seed-rewildingeurope.mjs — Rewilding Europe seeder
 * European rewilding stories, wildlife comebacks, and habitat restoration.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "rewildingeurope.com",
  cacheFileName: "rewildingeurope.json",
  displayName: "🌍 Rewilding Europe",
  feedUrl: "https://rewildingeurope.com/feed",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*Rewilding Europe\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "rewildingeurope",
  seeder_score: 0.75,
  maxArticles: 2000,
  maxPages: 20,
});