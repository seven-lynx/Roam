/**
 * seed-smithsonian-ocean.mjs — Smithsonian Ocean Portal seeder
 * Marine biology, oceanography, ocean conservation, sea life.
 * Category: SCIENCE → OCEANOGRAPHY_MARINE_LIFE
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "ocean.si.edu",
  cacheFileName: "smithsonian-ocean.json",
  displayName: "🌊 Smithsonian Ocean",
  articlePathRegex: /\/(ocean-life|planet-ocean|ocean-through-time|conservation|human-connections)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*Smithsonian Ocean\s*$/i,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.OCEANOGRAPHY_MARINE_LIFE,
  source: "smithsonian-ocean",
  seeder_score: 0.85,
  maxPages: 30,
});