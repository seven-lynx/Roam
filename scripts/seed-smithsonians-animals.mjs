/**
 * seed-smithsonians-animals.mjs — Smithsonian Magazine Animals seeder
 * Animal behavior, wildlife science, and natural history journalism.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.smithsonianmag.com",
  cacheFileName: "smithsonians-animals.json",
  displayName: "🏛️ Smithsonian Animals",
  feedUrl: "https://www.smithsonianmag.com/category/science-nature/wildlife/rss",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*Smithsonian\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "smithsonian",
  seeder_score: 0.8,
  maxArticles: 2000,
  maxPages: 20,
});