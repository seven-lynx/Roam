/**
 * seed-petrolicious.mjs — Petrolicious seeder
 * Enthusiast car culture, automotive design appreciation, owner stories.
 * Category: GAMES_HOBBIES → COLLECTING
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "petrolicious.com",
  cacheFileName: "petrolicious.json",
  displayName: "🎨 Petrolicious",
  articlePathRegex: /\/(articles|films|features)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*Petrolicious\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.COLLECTING,
  source: "petrolicious",
  seeder_score: 0.7,
  maxPages: 10,
});