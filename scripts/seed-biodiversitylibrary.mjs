/**
 * seed-biodiversitylibrary.mjs — Biodiversity Heritage Library seeder
 * Natural history illustrations, taxonomic literature, and museum specimen archives.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "blog.biodiversitylibrary.org",
  cacheFileName: "biodiversitylibrary.json",
  displayName: "📚 Biodiversity Heritage Library",
  feedUrl: "https://blog.biodiversitylibrary.org/feed",
  articlePathRegex: /\/\d{4}\/\d{2}\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /[-–—]\s*Biodiversity Heritage Library\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "biodiversitylibrary",
  seeder_score: 0.8,
  maxArticles: 2000,
  maxPages: 20,
});