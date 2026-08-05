/**
 * seed-hssonline.mjs — History of Science Society seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "hssonline.org",
  cacheFileName: "hssonline.json",
  displayName: "📚 History of Science Society",
  feedUrl: "https://hssonline.org/feed/",
  articlePathRegex: /(news|resources|publications)/,
  siteSuffixRegex: \s*[-–—]\s*hssonline.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "hssonline",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
