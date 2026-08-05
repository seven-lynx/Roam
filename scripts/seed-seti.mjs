/**
 * seed-seti.mjs — SETI Institute seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.seti.org",
  cacheFileName: "seti.json",
  displayName: "👽 SETI Institute",
  feedUrl: "https://www.seti.org/rss.xml",
  articlePathRegex: /(press-release|article|event)/,
  siteSuffixRegex: \s*[-–—]\s*seti.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "seti",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
