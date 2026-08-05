/**
 * seed-sandiegozoo.mjs — San Diego Zoo Wildlife Alliance seeder
 * Conservation science, species stories, and zoo wildlife features.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "sandiegozoowildlifealliance.org",
  cacheFileName: "sandiegozoo.json",
  displayName: "🦍 San Diego Zoo",
  feedUrl: "https://sandiegozoowildlifealliance.org/rss.xml",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*San Diego Zoo Wildlife Alliance\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "sandiegozoo",
  seeder_score: 0.75,
  maxArticles: 2000,
  maxPages: 20,
});