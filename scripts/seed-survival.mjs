/**
 * seed-survival.mjs — Survival & Outdoors (RSS → Sitemap → Wayback)
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "outdoorlife.com",
  cacheFileName: "survival.json",
  displayName: "🪓 Outdoor Life",
  feedUrl: "https://www.outdoorlife.com/feed/",
  articlePathRegex: /\/(survival|hunting|fishing|guns|gear|conservation|skills|story)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*\|\s*Outdoor\s*Life$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.OUTDOOR_ADVENTURE,
  source: "survival",
  maxArticles: 1000,
  maxPages: 15,
});