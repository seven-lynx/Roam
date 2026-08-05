/**
 * seed-sneakers.mjs — Sneakers & Streetwear (RSS → Sitemap → Wayback)
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "sneakernews.com",
  cacheFileName: "sneakers.json",
  displayName: "👟 Sneaker News",
  feedUrl: "https://sneakernews.com/feed/",
  articlePathRegex: /\/(nike|jordan|adidas|new-balance|asics|puma|reebok|news|features|release-dates|editorial)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*\|\s*SneakerNews\.com$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.COLLECTING,
  source: "sneakers",
  maxArticles: 1000,
  maxPages: 15,
});