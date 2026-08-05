/**
 * seed-explorersweb.mjs — ExplorersWeb seeder
 * Exploration, mountaineering, polar expeditions, adventure travel, discovery.
 * Category: HISTORY_IDEAS → EXPLORATION_DISCOVERY
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "explorersweb.com",
  cacheFileName: "explorersweb.json",
  displayName: "🧭 ExplorersWeb",
  articlePathRegex: /\/(mountaineering|polar|oceans|adventure|exploration)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*ExplorersWeb\s*$/i,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "explorersweb",
  seeder_score: 0.75,
  maxPages: 20,
});