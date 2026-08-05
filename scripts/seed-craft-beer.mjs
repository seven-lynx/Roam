/**
 * seed-craft-beer.mjs — Craft Beer & Homebrew (RSS → Sitemap → Wayback)
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "beerandbrewing.com",
  cacheFileName: "craft-beer.json",
  displayName: "🍺 Craft Beer & Brewing",
  feedUrl: "https://beerandbrewing.com/feed/",
  articlePathRegex: /\/(article|recipe|review|feature|news|editorial|how-to|guides)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*\|\s*Craft\s*Beer\s*&\s*Brewing$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.COOKING_FOOD,
  source: "craft-beer",
  maxArticles: 1000,
  maxPages: 15,
});