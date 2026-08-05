/**
 * seed-eurogamer.mjs — Eurogamer / Digital Foundry seeder
 * Technical game analysis, performance deep-dives, gaming hardware reviews.
 * Category: GAMES_HOBBIES → VIDEO_GAMES
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "eurogamer.net",
  cacheFileName: "eurogamer.json",
  displayName: "🎮 Eurogamer",
  articlePathRegex: /\/(features|reviews|news|guides|opinion|digitalfoundry)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*Eurogamer(?:\.net)?\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.VIDEO_GAMES,
  source: "eurogamer",
  seeder_score: 0.7,
  maxPages: 20,
});