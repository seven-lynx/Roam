/**
 * seed-britishmuseum-science.mjs — British Museum History seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.britishmuseum.org",
  cacheFileName: "britishmuseum-science.json",
  displayName: "🏛 British Museum History",
  feedUrl: "https://www.britishmuseum.org/blog/feed",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*britishmuseum.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "britishmuseum",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
