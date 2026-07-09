/**
 * seed-food52.mjs — Food52 seeder
 * Recipes, cooking techniques, kitchen design, and food community.
 * Category: GAMES_HOBBIES → COOKING_FOOD
 * Multi-method: RSS → Sitemap → Wayback → RSS Auto
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "food52.com",
  cacheFileName: "food52.json",
  displayName: "🍽️ Food52",
  feedUrl: "https://food52.com/feed/",
  articlePathRegex: /\/(recipes|blog|how-to|kitchen|entertaining|travel)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[\|\-]\s*Food52\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.COOKING_FOOD,
  source: "food52",
  seeder_score: 0.8,
  maxArticles: 2000,
  maxPages: 25,
});