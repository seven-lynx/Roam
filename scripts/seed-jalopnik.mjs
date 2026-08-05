/**
 * seed-jalopnik.mjs — Jalopnik seeder
 * Car culture, automotive engineering, motorsport coverage.
 * Category: GAMES_HOBBIES → SPORTS_ATHLETICS
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "jalopnik.com",
  cacheFileName: "jalopnik.json",
  displayName: "🏎️ Jalopnik",
  articlePathRegex: /\/(\d+\/[a-z0-9-]+|feature|review|news|buying-guide|car-culture|motorsport|technology|garage)\/?$/i,
  siteSuffixRegex: /\s*[\|\-]\s*(?:Jalopnik|The Autopian)\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.SPORTS_ATHLETICS,
  source: "jalopnik",
  seeder_score: 0.7,
  maxPages: 30,
});