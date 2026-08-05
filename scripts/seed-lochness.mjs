/**
 * seed-lochness.mjs — Loch Ness seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.lochness.co.uk",
  cacheFileName: "lochness.json",
  displayName: "🐍 Loch Ness",
  feedUrl: "https://www.lochness.co.uk/feed/",
  articlePathRegex: /(news|sightings|history)/,
  siteSuffixRegex: \s*[-–—]\s*lochness.co.uk\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "lochness",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
