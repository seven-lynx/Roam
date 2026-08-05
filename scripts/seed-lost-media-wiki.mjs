/**
 * seed-lost-media-wiki.mjs — Lost Media Wiki seeder
 * Lost films, TV episodes, video games, music, and other missing media.
 * Category: WEIRD_WONDERFUL → LOST_MEDIA
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "lostmediawiki.com",
  cacheFileName: "lost-media-wiki.json",
  displayName: "📼 Lost Media Wiki",
  articlePathRegex: /\/([A-Z][a-z0-9-]+)(_\([^)]+\))?$/,
  siteSuffixRegex: /\s*[-–]\s*The Lost Media Wiki\s*$/i,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.LOST_MEDIA,
  source: "lost-media-wiki",
  seeder_score: 0.6,
  maxPages: 15,
});