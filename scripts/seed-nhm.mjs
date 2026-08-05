/**
 * seed-nhm.mjs — Natural History Museum London seeder
 * Natural history collections, taxonomy, evolution, and biodiversity research.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.nhm.ac.uk",
  cacheFileName: "nhm.json",
  displayName: "🦖 NHM London",
  feedUrl: "https://www.nhm.ac.uk/discover/feed.xml",
  articlePathRegex: /\/discover\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*Natural History Museum\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "nhm",
  seeder_score: 0.8,
  maxArticles: 2000,
  maxPages: 20,
});