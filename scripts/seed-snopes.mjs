/**
 * seed-snopes.mjs — Snopes fact-check / urban legends seeder
 * Urban legends, folklore, fact-checking deep dives, internet rumors.
 * Category: WEIRD_WONDERFUL → URBAN_LEGENDS_FOLKLORE
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "snopes.com",
  cacheFileName: "snopes.json",
  displayName: "🔍 Snopes",
  articlePathRegex: /\/(fact-check|news|collections)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*Snopes\.com\s*$/i,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.URBAN_LEGENDS_FOLKLORE,
  source: "snopes",
  seeder_score: 0.7,
  maxPages: 40,
});