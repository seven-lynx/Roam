/**
 * seed-laphams.mjs — Lapham's Quarterly seeder
 * History essays organized by theme (War, Money, Time, etc.) — deeply curated.
 * Category: HISTORY_IDEAS → SOCIAL_HISTORY
 * Multi-method: RSS → Sitemap → Wayback CDX
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "laphamsquarterly.org",
  cacheFileName: "laphams.json",
  displayName: "📜 Lapham's Quarterly",
  feedUrl: "https://www.laphamsquarterly.org/rss.xml",
  articlePathRegex: /\/[a-z-]+\/[a-z0-9-]+$/i,
  siteSuffixRegex: /[–\-|]\s*Lapham['']s Quarterly\s*$/i,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.SOCIAL_HISTORY,
  source: "laphams",
  seeder_score: 0.8,
});