/**
 * seed-roadtrippers.mjs — Roadtrippers seeder
 * Road trip routes, roadside attractions, Americana, hidden gems.
 * Category: PEOPLE_PLACES → TRAVEL_EXPLORATION
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "roadtrippers.com",
  cacheFileName: "roadtrippers.json",
  displayName: "🛣️ Roadtrippers",
  articlePathRegex: /\/(magazine|stories|destinations|guides)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*Roadtrippers\s*$/i,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.TRAVEL_EXPLORATION,
  source: "roadtrippers",
  seeder_score: 0.65,
  maxPages: 15,
});