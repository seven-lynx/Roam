/**
 * seed-snow-sports.mjs — Skiing & Snowboarding seeder
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "freeskier.com",
  cacheFileName: "snow-sports.json",
  displayName: "🏔️ FREESKIER",
  articlePathRegex: /\/(news|gear|videos|resorts|features|how-to|travel)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*\|\s*FREESKIER$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.SPORTS_ATHLETICS,
  source: "snow-sports",
  maxPages: 20,
});