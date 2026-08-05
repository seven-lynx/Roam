/**
 * seed-woodworking.mjs — Woodworking & Shop Skills seeder
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "woodworkingnetwork.com",
  cacheFileName: "woodworking.json",
  displayName: "🪚 Woodworking Network",
  articlePathRegex: /\/(news|features|how-to|projects|design|technology)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*Woodworking\s*Network$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.CRAFTS_DIY_MAKING,
  source: "woodworking",
  maxPages: 20,
});