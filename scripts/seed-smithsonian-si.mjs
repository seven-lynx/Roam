/**
 * seed-smithsonian-si.mjs — Smithsonian History seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.si.edu",
  cacheFileName: "smithsonian-si.json",
  displayName: "🏛 Smithsonian History",
  feedUrl: "https://www.si.edu/feed",
  articlePathRegex: /(newsdesk|stories|exhibitions)/,
  siteSuffixRegex: \s*[-–—]\s*si.edu\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "smithsonian-si",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
