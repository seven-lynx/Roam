/**
 * seed-freakonomics.mjs — Freakonomics seeder
 * Counterintuitive economics stories, behavioral science.
 * Category: HISTORY_IDEAS → ECONOMICS_HISTORY
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "freakonomics.com",
  cacheFileName: "freakonomics.json",
  displayName: "🎙️ Freakonomics",
  articlePathRegex: /\/(podcast|blog|article)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*Freakonomics\s*$/i,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.ECONOMICS_HISTORY,
  source: "freakonomics",
  seeder_score: 0.7,
  maxPages: 8,
});