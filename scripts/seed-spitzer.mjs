/**
 * seed-spitzer.mjs — Spitzer seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.spitzer.caltech.edu",
  cacheFileName: "spitzer.json",
  displayName: "🔭 Spitzer",
  feedUrl: "https://www.spitzer.caltech.edu/news/feed",
  articlePathRegex: /news/|/image/,
  siteSuffixRegex: \s*[-–—]\s*spitzer.caltech.edu\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "spitzer",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
