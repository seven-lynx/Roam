/**
 * seed-eana.mjs — EANA seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.eana-net.eu",
  cacheFileName: "eana.json",
  displayName: "🛸 EANA",
  feedUrl: "https://www.eana-net.eu/feed/",
  articlePathRegex: /./,
  siteSuffixRegex: \s*[-–—]\s*eana-net.eu\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "eana",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
