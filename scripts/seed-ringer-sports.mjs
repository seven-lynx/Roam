/**
 * seed-ringer-sports.mjs — The Ringer sports section seeder
 * Sports culture, NBA/NFL/MLB/NHL analysis, golf, tennis, boxing, MMA, F1.
 * Category: GAMES_HOBBIES → SPORTS_ATHLETICS
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "theringer.com",
  cacheFileName: "ringer-sports.json",
  displayName: "🏀 The Ringer Sports",
  articlePathRegex: /\/(nba|nfl|mlb|nhl|soccer|college|golf|tennis|boxing|mma|wrestling|f1|sports)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*The Ringer\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.SPORTS_ATHLETICS,
  source: "ringer-sports",
  seeder_score: 0.7,
  maxPages: 25,
});