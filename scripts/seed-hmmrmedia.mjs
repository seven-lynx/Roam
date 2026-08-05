/**
 * seed-hmmrmedia.mjs — HMMR Media seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.hmmrmedia.com",
  cacheFileName: "hmmrmedia.json",
  displayName: "💪 HMMR Media",
  feedUrl: "https://www.hmmrmedia.com/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*hmmrmedia.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "hmmrmedia",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
