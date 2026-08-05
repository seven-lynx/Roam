/**
 * seed-exoplanet-eu.mjs — Exoplanet.eu seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "exoplanet.eu",
  cacheFileName: "exoplanet-eu.json",
  displayName: "🌌 Exoplanet.eu",
  feedUrl: "https://exoplanet.eu/feed/",
  articlePathRegex: /./,
  siteSuffixRegex: \s*[-–—]\s*exoplanet.eu\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "exoplanet-eu",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
