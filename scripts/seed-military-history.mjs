/**
 * seed-military-history.mjs — Military History seeder
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "warfarehistorynetwork.com",
  cacheFileName: "military-history.json",
  displayName: "⚔️ Warfare History Network",
  articlePathRegex: /\/(article|editorial|feature|book-review)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*\|\s*Warfare\s*History\s*Network$/i,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.MILITARY_HISTORY,
  source: "military-history",
  maxPages: 20,
});