/**
 * seed-cartography.mjs — Cartography / Library of Congress Maps seeder
 * Historical maps, cartography history, geographic exploration, mapmaking art.
 * Category: PEOPLE_PLACES → MAPS_CARTOGRAPHY
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "loc.gov",
  cacheFileName: "cartography.json",
  displayName: "🗺️ Cartography (LOC Maps)",
  articlePathRegex: /\/(maps|collections)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*Library of Congress\s*$/i,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MAPS_CARTOGRAPHY,
  source: "cartography",
  seeder_score: 0.75,
  maxPages: 15,
});