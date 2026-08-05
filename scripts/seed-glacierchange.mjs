/**
 * seed-glacierchange.mjs — Glacier Change seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.graniteglacier-blog.com",
  cacheFileName: "glacierchange.json",
  displayName: "❄ Glacier Change",
  feedUrl: "https://www.graniteglacier-blog.com/feed/",
  articlePathRegex: /(blog)/,
  siteSuffixRegex: \s*[-–—]\s*graniteglacier-blog.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "glacierchange",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
