/**
 * seed-computerhistory.mjs — Computer History Museum seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "computerhistory.org",
  cacheFileName: "computerhistory.json",
  displayName: "💻 Computer History Museum",
  feedUrl: "https://computerhistory.org/feed/",
  articlePathRegex: /(blog|timeline|exhibits)/,
  siteSuffixRegex: \s*[-–—]\s*computerhistory.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "computerhistory",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
