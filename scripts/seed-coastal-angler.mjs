/**
 * seed-coastal-angler.mjs — Coastal Angler Magazine seeder
 * Saltwater fishing, coastal fishing reports, techniques, and gear.
 * Category: GAMES_HOBBIES → FISHING
 * Uses Wayback CDX for this regional magazine site.
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "coastalanglermag.com",
  cacheFileName: "coastal-angler.json",
  displayName: "🌊 Coastal Angler",
  articlePathRegex: /\/(fishing|techniques|gear|destinations|reports|conservation|species)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[\|\-]\s*Coastal\s+Angler\s+Magazine\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.FISHING,
  source: "coastal-angler",
  seeder_score: 0.7,
  maxPages: 15,
});