/**
 * seed-centauri-dreams.mjs — Centauri Dreams seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.centauri-dreams.org",
  cacheFileName: "centauri-dreams.json",
  displayName: "🌠 Centauri Dreams",
  feedUrl: "https://www.centauri-dreams.org/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*centauri-dreams.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "centauri-dreams",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
