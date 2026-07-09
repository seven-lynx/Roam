/**
 * seed-forks-over-knives.mjs — Forks Over Knives seeder
 * Plant-based recipes, nutrition science, meal planning, and whole-food cooking.
 * Category: GAMES_HOBBIES → COOKING_FOOD
 * Multi-method: RSS → Sitemap → Wayback → RSS Auto
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.forksoverknives.com",
  cacheFileName: "forks-over-knives.json",
  displayName: "🥗 Forks Over Knives",
  feedUrl: "https://www.forksoverknives.com/feed/",
  articlePathRegex: /\/(recipes|nutrition|meal-planning|health|success-stories|how-to)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[\|\-]\s*Forks\s+Over\s+Knives\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.COOKING_FOOD,
  source: "forks-over-knives",
  seeder_score: 0.8,
  maxArticles: 1500,
  maxPages: 20,
});