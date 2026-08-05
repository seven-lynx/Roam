/**
 * seed-bloomberg.mjs — Bloomberg editorial seeder
 * Market analysis, business profiles, financial history, economic commentary.
 * Category: HISTORY_IDEAS → ECONOMICS_HISTORY
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "bloomberg.com",
  cacheFileName: "bloomberg.json",
  displayName: "📊 Bloomberg",
  articlePathRegex: /\/(news\/features|news\/articles|opinion|features|graphics|gadfly|quicktake|businessweek)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\-\|]\s*Bloomberg\s*$/i,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.ECONOMICS_HISTORY,
  source: "bloomberg",
  seeder_score: 0.75,
  maxPages: 25,
});