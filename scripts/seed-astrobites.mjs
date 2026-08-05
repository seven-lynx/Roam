/**
 * seed-astrobites.mjs — Astrobites seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "astrobites.org",
  cacheFileName: "astrobites.json",
  displayName: "🛰 Astrobites",
  feedUrl: "https://astrobites.org/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*astrobites.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "astrobites",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
