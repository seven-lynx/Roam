/**
 * seed-rockpapershotgun.mjs — Rock Paper Shotgun seeder
 * PC gaming coverage, indie game discovery, developer interviews, hardware guides.
 * Category: GAMES_HOBBIES → VIDEO_GAMES
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "rockpapershotgun.com",
  cacheFileName: "rockpapershotgun.json",
  displayName: "🖥️ Rock Paper Shotgun",
  articlePathRegex: /\/(features|reviews|news|guides|opinion)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*Rock Paper Shotgun\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.VIDEO_GAMES,
  source: "rockpapershotgun",
  seeder_score: 0.7,
  maxPages: 30,
});