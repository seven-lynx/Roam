/**
 * seed-nerdwallet.mjs — NerdWallet seeder
 * Personal finance explainers, investing guides, credit education, tax tips.
 * Category: HISTORY_IDEAS → ECONOMICS_HISTORY
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "nerdwallet.com",
  cacheFileName: "nerdwallet.json",
  displayName: "💳 NerdWallet",
  articlePathRegex: /\/(article|learn)\/[a-z0-9-]/i,
  skipPaths: [/\/review\//, /\/compare\//, /\/calculator\//, /\/find\//],
  siteSuffixRegex: /\s*[\|\-]\s*NerdWallet\s*$/i,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.ECONOMICS_HISTORY,
  source: "nerdwallet",
  seeder_score: 0.65,
  maxPages: 15,
});