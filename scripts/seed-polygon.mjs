/**
 * seed-polygon.mjs — Polygon seeder
 * Game reviews, gaming culture, retrospectives, developer interviews.
 * Category: GAMES_HOBBIES → VIDEO_GAMES
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "polygon.com",
  cacheFileName: "polygon.json",
  displayName: "🎮 Polygon",
  articlePathRegex: /\/(\d+\/[a-z0-9-]+|review|feature|news|guides|opinion|gaming|entertainment|tv-anime|movies|comics|tech|podcast)\/?$/i,
  siteSuffixRegex: /\s*\|\s*Polygon\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.VIDEO_GAMES,
  source: "polygon",
  seeder_score: 0.7,
  maxPages: 50,
});