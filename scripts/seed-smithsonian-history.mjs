/**
 * seed-smithsonian-history.mjs — Smithsonian Magazine History seeder
 * Ancient history, medieval, historical features, archaeology news.
 * Category: HISTORY_IDEAS → ANCIENT_MEDIEVAL_HISTORY
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "smithsonianmag.com",
  cacheFileName: "smithsonian-history.json",
  displayName: "📜 Smithsonian History",
  articlePathRegex: /\/(history|smart-news|science-nature)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*Smithsonian\s*$/i,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.ANCIENT_MEDIEVAL_HISTORY,
  source: "smithsonian-history",
  seeder_score: 0.85,
  maxPages: 40,
});