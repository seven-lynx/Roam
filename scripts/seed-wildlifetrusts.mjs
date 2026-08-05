/**
 * seed-wildlifetrusts.mjs — The Wildlife Trusts seeder (UK)
 * British wildlife conservation, nature reserves, and species guides.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.wildlifetrusts.org",
  cacheFileName: "wildlifetrusts.json",
  displayName: "🦔 Wildlife Trusts",
  feedUrl: "https://www.wildlifetrusts.org/rss.xml",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*The Wildlife Trusts\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "wildlifetrusts",
  seeder_score: 0.75,
  maxArticles: 2000,
  maxPages: 20,
});