/**
 * seed-espn.mjs — ESPN editorial seeder
 * Feature stories, athlete profiles, sports history, investigative pieces.
 * Category: GAMES_HOBBIES → SPORTS_ATHLETICS
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "espn.com",
  cacheFileName: "espn.json",
  displayName: "🏈 ESPN",
  articlePathRegex: /\/(nba|nfl|mlb|nhl|college-football|college-basketball|soccer|golf|tennis|boxing|mma|racing|olympics|story)\//i,
  skipPaths: [/\/scoreboard/, /\/schedule/, /\/standings/, /\/stats/, /\/watch/, /\/fantasy/],
  siteSuffixRegex: /\s*[\-\|]\s*ESPN\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.SPORTS_ATHLETICS,
  source: "espn",
  seeder_score: 0.7,
  maxPages: 40,
});