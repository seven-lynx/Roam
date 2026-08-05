/**
 * seed-worldhistory.mjs — World History Encyclopedia seeder
 * Religion, mythology, ancient civilizations, world cultures.
 * Category: HISTORY_IDEAS → RELIGION_MYTHOLOGY
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "worldhistory.org",
  cacheFileName: "worldhistory.json",
  displayName: "🏺 World History",
  articlePathRegex: /\/(article|definition)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[-–]\s*World History Encyclopedia\s*$/i,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.RELIGION_MYTHOLOGY,
  source: "worldhistory",
  seeder_score: 0.8,
  maxPages: 30,
});