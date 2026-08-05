/**
 * seed-thedrive.mjs — The Drive seeder
 * Car tech deep-dives, engineering explainers, industry news, restoration.
 * Category: TECHNOLOGY → HARDWARE_ELECTRONICS
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "thedrive.com",
  cacheFileName: "thedrive.json",
  displayName: "🔧 The Drive",
  articlePathRegex: /\/(news|tech|reviews|features|guides|car-reviews)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*The Drive\s*$/i,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.HARDWARE_ELECTRONICS,
  source: "thedrive",
  seeder_score: 0.7,
  maxPages: 15,
});