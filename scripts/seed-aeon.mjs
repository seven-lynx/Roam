/**
 * seed-aeon.mjs — Aeon seeder
 * Long-form essays on philosophy, science, culture — heavily curated, no ads.
 * Category: HISTORY_IDEAS → PHILOSOPHY_ETHICS
 * Multi-method: RSS → Sitemap → Wayback CDX
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "aeon.co",
  cacheFileName: "aeon.json",
  displayName: "📜 Aeon",
  feedUrl: "https://aeon.co/feed.rss",
  articlePathRegex: /\/essays\/[a-z0-9-]+|\/ideas\/[a-z0-9-]+|\/videos\/[a-z0-9-]+/i,
  siteSuffixRegex: /[–\-|]\s*Aeon\s*$/i,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.PHILOSOPHY_ETHICS,
  source: "aeon",
  seeder_score: 0.9,
});