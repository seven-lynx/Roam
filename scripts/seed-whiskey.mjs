/**
 * seed-whiskey.mjs — Whiskey & Spirits (RSS → Sitemap → Wayback)
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "vinepair.com",
  cacheFileName: "whiskey.json",
  displayName: "🥃 VinePair (whiskey/spirits)",
  feedUrl: "https://vinepair.com/feed/",
  articlePathRegex: /\/(articles|reviews|guides|buying-guides|spirits|whiskey|bourbon)\/[a-z0-9-]/i,
  skipPaths: [/\/wine\//, /\/beer\//],
  siteSuffixRegex: /\s*\|\s*VinePair$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.COOKING_FOOD,
  source: "whiskey",
  maxArticles: 1000,
  maxPages: 15,
});