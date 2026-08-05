/**
 * seed-boardgamegeek.mjs — BoardGameGeek seeder
 * Board game reviews, strategy guides, tabletop culture, design articles.
 * Category: GAMES_HOBBIES → BOARD_GAMES_TABLETOP
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "boardgamegeek.com",
  cacheFileName: "boardgamegeek.json",
  displayName: "🎲 BoardGameGeek",
  articlePathRegex: /\/(blogpost|thread|boardgame|boardgameexpansion|wiki)\/\d+\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|?\s*BoardGameGeek\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.BOARD_GAMES_TABLETOP,
  source: "boardgamegeek",
  seeder_score: 0.8,
  maxPages: 50,
});