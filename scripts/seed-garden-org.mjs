/**
 * seed-garden-org.mjs — RHS / Garden.org seeder
 * Gardening tips, horticulture guides, plant care, landscape design.
 * Category: GAMES_HOBBIES → GARDENING_HORTICULTURE
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "garden.org",
  cacheFileName: "garden-org.json",
  displayName: "🌻 Garden.org",
  articlePathRegex: /\/(plants|gardening|learn|articles)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[-–]\s*Garden\.org\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.GARDENING_HORTICULTURE,
  source: "garden-org",
  seeder_score: 0.7,
  maxPages: 25,
});