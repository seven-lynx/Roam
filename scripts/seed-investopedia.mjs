/**
 * seed-investopedia.mjs — Investopedia seeder
 * Encyclopedia of finance terms, investing concepts, economic explainers.
 * Category: HISTORY_IDEAS → ECONOMICS_HISTORY
 * Access: Wayback CDX (Cloudflare-protected live)
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "investopedia.com",
  cacheFileName: "investopedia.json",
  displayName: "💰 Investopedia",
  articlePathRegex: /\/(terms|articles|ask\/answers|insights|financial-edge|advisor|investing|trading|personal-finance|retirement|insurance|mortgage|loans|credit-cards|banking|taxes|savings|budgeting|debt|estate-planning|economics|cryptocurrency|real-estate-investing|commodities|forex|options|futures|bonds|stocks|etfs|mutualfunds|financial-advisor|wealth-management|portfolio-management|technical-analysis|fundamental-analysis|day-trading|value-investing|growth-investing|dividend-investing)\//,
  siteSuffixRegex: /\s*\|\s*Investopedia\s*$/i,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.ECONOMICS_HISTORY,
  source: "investopedia",
  seeder_score: 0.75,
  maxPages: 60,
});