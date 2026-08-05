/**
 * seed-earthfiles.mjs — Earthfiles seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.earthfiles.com",
  cacheFileName: "earthfiles.json",
  displayName: "🌍 Earthfiles",
  feedUrl: "https://www.earthfiles.com/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*earthfiles.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "earthfiles",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
