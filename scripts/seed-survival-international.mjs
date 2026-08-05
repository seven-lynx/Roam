/**
 * seed-survival-international.mjs — Survival International seeder
 * Indigenous cultures, tribal peoples, land rights, cultural preservation.
 * Category: PEOPLE_PLACES → INDIGENOUS_CULTURES
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "survivalinternational.org",
  cacheFileName: "survival-international.json",
  displayName: "🏕️ Survival International",
  articlePathRegex: /\/(news|articles|tribes|about)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[-–]\s*Survival International\s*$/i,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.INDIGENOUS_CULTURES,
  source: "survival-international",
  seeder_score: 0.7,
  maxPages: 10,
});