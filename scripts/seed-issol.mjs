/**
 * seed-issol.mjs — ISSOL seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "issol.org",
  cacheFileName: "issol.json",
  displayName: "🧫 ISSOL",
  feedUrl: "https://issol.org/feed/",
  articlePathRegex: /./,
  siteSuffixRegex: \s*[-–—]\s*issol.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "issol",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
