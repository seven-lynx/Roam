/**
 * seed-insightfulanimals.mjs — Insightful Animals seeder
 * Pet cognition, animal behavior, and psychology for pet owners.
 * Category: GAMES_HOBBIES → PETS
 * Uses Wayback CDX due to potential bot protection on smaller academic-style blogs.
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "insightfulanimals.com",
  cacheFileName: "insightfulanimals.json",
  displayName: "🐱 Insightful Animals",
  articlePathRegex: /\/(blog|articles|cognition|behavior|training|care)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[\|\-]\s*Insightful\s+Animals\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "insightfulanimals",
  seeder_score: 0.7,
  maxPages: 15,
});