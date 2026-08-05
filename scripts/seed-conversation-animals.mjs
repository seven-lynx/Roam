/**
 * seed-conversation-animals.mjs — The Conversation Animals seeder
 * Academic journalism on animal behavior, conservation, and ecology.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "theconversation.com",
  cacheFileName: "conversation-animals.json",
  displayName: "🎓 The Conversation (Animals)",
  feedUrl: "https://theconversation.com/us/technology/articles.rss",
  articlePathRegex: /\/[a-z0-9-]+\/\d+\/?$/i,
  siteSuffixRegex: /\s*[-–—]\s*The Conversation\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "conversation",
  seeder_score: 0.75,
  maxArticles: 2000,
  maxPages: 20,
});