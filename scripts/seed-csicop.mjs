/**
 * seed-csicop.mjs — CSI seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.csicop.org",
  cacheFileName: "csicop.json",
  displayName: "🔬 CSI",
  feedUrl: "https://www.csicop.org/feed/",
  articlePathRegex: /(specialarticles|si)/,
  siteSuffixRegex: \s*[-–—]\s*csicop.org\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "csicop",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
