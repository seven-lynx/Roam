/**
 * seed-architectural-review.mjs — Architectural Review seeder
 * Architecture criticism, urban design, building history, spatial theory.
 * Category: ARTS_CULTURE → ARCHITECTURE_URBAN
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "architectural-review.com",
  cacheFileName: "architectural-review.json",
  displayName: "🏗️ Architectural Review",
  articlePathRegex: /\/(essay|building|folio|rethink|view)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[-–]\s*The Architectural Review\s*$/i,
  category_id: CATEGORY.ARTS_CULTURE,
  subcategory_id: SUBCATEGORY.ARCHITECTURE_URBAN,
  source: "architectural-review",
  seeder_score: 0.8,
  maxPages: 25,
});