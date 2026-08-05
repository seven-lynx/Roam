/**
 * seed-esa-exoplanets.mjs — ESA Exoplanets seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "sci.esa.int",
  cacheFileName: "esa-exoplanets.json",
  displayName: "🛰 ESA Exoplanets",
  feedUrl: "https://sci.esa.int/web/exoplanets/-/rss",
  articlePathRegex: /web/exoplanets/,
  siteSuffixRegex: \s*[-–—]\s*sci.esa.int\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "esa-exoplanets",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
