/**
 * seed-inaturalist.mjs — iNaturalist seeder
 * Community science observations, wildlife identification, and biodiversity stories.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.inaturalist.org",
  cacheFileName: "inaturalist.json",
  displayName: "🌿 iNaturalist",
  feedUrl: "https://www.inaturalist.org/blog.rss",
  articlePathRegex: /\/blog\/[a-z0-9-]+/i,
  siteSuffixRegex: /\s*·\s*iNaturalist\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "inaturalist",
  seeder_score: 0.8,
  maxArticles: 2000,
  maxPages: 20,
});