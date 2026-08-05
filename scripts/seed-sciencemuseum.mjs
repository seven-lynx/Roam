/**
 * seed-sciencemuseum.mjs — Science Museum seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.sciencemuseum.org.uk",
  cacheFileName: "sciencemuseum.json",
  displayName: "🔬 Science Museum",
  feedUrl: "https://www.sciencemuseum.org.uk/rss.xml",
  articlePathRegex: /(objects-and-stories|see-and-do)/,
  siteSuffixRegex: \s*[-–—]\s*sciencemuseum.org.uk\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "sciencemuseum",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
