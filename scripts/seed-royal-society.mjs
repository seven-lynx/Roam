/**
 * seed-royal-society.mjs — Royal Society blog seeder
 * History of science, scientific discovery, groundbreaking research, science biographies.
 * Category: HISTORY_IDEAS → HISTORY_SCIENCE_TECHNOLOGY
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "royalsociety.org",
  cacheFileName: "royal-society.json",
  displayName: "🔬 Royal Society",
  articlePathRegex: /\/(blog|journals)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*Royal Society\s*$/i,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "royal-society",
  seeder_score: 0.85,
  maxPages: 20,
});