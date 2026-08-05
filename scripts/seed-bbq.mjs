/**
 * seed-bbq.mjs — BBQ & Grilling (RSS → Sitemap → Wayback)
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "amazingribs.com",
  cacheFileName: "bbq.json",
  displayName: "🥩 Amazing Ribs",
  feedUrl: "https://amazingribs.com/feed/",
  articlePathRegex: /\/(recipe|technique|science|gear|reviews|tips|guides)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*\|\s*AmazingRibs\.com$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.COOKING_FOOD,
  source: "bbq",
  maxArticles: 1000,
  maxPages: 15,
});