/**
 * seed-watches.mjs — Watches & Horology seeder (RSS → Sitemap → Wayback)
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "hodinkee.com",
  cacheFileName: "watches.json",
  displayName: "⌚ Hodinkee",
  feedUrl: "https://www.hodinkee.com/feed/",
  articlePathRegex: /\/(articles|reviews|introducing|hands-on|editorial|guides|news)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*\|\s*Hodinkee$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.COLLECTING,
  source: "watches",
  maxArticles: 1000,
  maxPages: 15,
});