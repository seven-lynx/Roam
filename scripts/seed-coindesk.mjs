/**
 * seed-coindesk.mjs — CoinDesk seeder
 * Cryptocurrency explainers, blockchain technology, digital money history.
 * Category: TECHNOLOGY → EMERGING_TECHNOLOGY
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "coindesk.com",
  cacheFileName: "coindesk.json",
  displayName: "₿ CoinDesk",
  articlePathRegex: /\/(tech|policy|markets|business|consensus|learn|opinion)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*CoinDesk\s*$/i,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.EMERGING_TECHNOLOGY,
  source: "coindesk",
  seeder_score: 0.7,
  maxPages: 20,
});