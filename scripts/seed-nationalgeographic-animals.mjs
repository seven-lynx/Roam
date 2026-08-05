/**
 * seed-nationalgeographic-animals.mjs — National Geographic Animals seeder
 * Wildlife photography, animal behavior, conservation journalism.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.nationalgeographic.com",
  cacheFileName: "natgeo-animals.json",
  displayName: "📸 Nat Geo Animals",
  feedUrl: "https://www.nationalgeographic.com/animals/rss",
  articlePathRegex: /\/animals\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*National Geographic\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "natgeo",
  seeder_score: 0.85,
  maxArticles: 2000,
  maxPages: 20,
});