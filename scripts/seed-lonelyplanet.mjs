/**
 * seed-lonelyplanet.mjs — Lonely Planet seeder
 * Destination guides, travel stories, cultural insights.
 * Category: PEOPLE_PLACES → TRAVEL_EXPLORATION
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "lonelyplanet.com",
  cacheFileName: "lonelyplanet.json",
  displayName: "✈️ Lonely Planet",
  articlePathRegex: /\/(articles|destinations|travel-tips|inspiration|stories|best-in-travel)\/[a-z0-9-]/i,
  siteSuffixRegex: /[\-\|]\s*Lonely\s*Planet\s*$/i,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.TRAVEL_EXPLORATION,
  source: "lonelyplanet",
  seeder_score: 0.7,
  maxPages: 30,
});