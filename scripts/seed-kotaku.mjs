/**
 * seed-kotaku.mjs — Kotaku seeder
 * Gaming news, culture deep-dives, retrospectives, industry analysis.
 * Category: GAMES_HOBBIES → VIDEO_GAMES
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "kotaku.com",
  cacheFileName: "kotaku.json",
  displayName: "🎮 Kotaku",
  articlePathRegex: /\/(\d+\/[a-z0-9-]+|review|feature|news|opinion|impressions)\/?$/i,
  siteSuffixRegex: /[\-\|]\s*Kotaku\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.VIDEO_GAMES,
  source: "kotaku",
  seeder_score: 0.7,
  maxPages: 40,
});