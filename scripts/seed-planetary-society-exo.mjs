/**
 * seed-planetary-society-exo.mjs — Planetary Society seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.planetary.org",
  cacheFileName: "planetary-society-exo.json",
  displayName: "🪐 Planetary Society",
  feedUrl: "https://www.planetary.org/feeds/latest",
  articlePathRegex: /(articles|space-images)/,
  siteSuffixRegex: \s*[-–—]\s*planetary.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "planetary-society",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
