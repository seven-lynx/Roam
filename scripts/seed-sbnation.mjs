/**
 * seed-sbnation.mjs — SBNation seeder
 * Deep fan content, team analysis, sports culture across 300+ team blogs.
 * Category: GAMES_HOBBIES → SPORTS_ATHLETICS
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "sbnation.com",
  cacheFileName: "sbnation.json",
  displayName: "🏟️ SBNation",
  articlePathRegex: /\/(nba|nfl|mlb|nhl|soccer|mma|college|nascar|golf|tennis|wwe)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*SBNation\.com\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.SPORTS_ATHLETICS,
  source: "sbnation",
  seeder_score: 0.65,
  maxPages: 50,
});