/**
 * seed-british-museum.mjs — British Museum blog seeder
 * Anthropology, archaeology, world cultures, ancient artifacts.
 * Category: HISTORY_IDEAS → ANTHROPOLOGY_ARCHAEOLOGY
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "britishmuseum.org",
  cacheFileName: "british-museum.json",
  displayName: "🏛️ British Museum",
  articlePathRegex: /\/(blog|collection|exhibition)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[-–]\s*British Museum\s*$/i,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.ANTHROPOLOGY_ARCHAEOLOGY,
  source: "british-museum",
  seeder_score: 0.85,
  maxPages: 30,
});