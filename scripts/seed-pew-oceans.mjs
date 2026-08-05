/**
 * seed-pew-oceans.mjs — Pew Oceans seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.pewtrusts.org",
  cacheFileName: "pew-oceans.json",
  displayName: "🌊 Pew Oceans",
  feedUrl: "https://www.pewtrusts.org/en/rss/research-and-analysis.rss",
  articlePathRegex: /(research-and-analysis|topic)/oceans/,
  siteSuffixRegex: \s*[-–—]\s*pewtrusts.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "pew-oceans",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
