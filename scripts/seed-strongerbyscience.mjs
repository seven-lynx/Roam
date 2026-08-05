/**
 * seed-strongerbyscience.mjs — Stronger by Science seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.strongerbyscience.com",
  cacheFileName: "strongerbyscience.json",
  displayName: "💪 Stronger by Science",
  feedUrl: "https://www.strongerbyscience.com/feed/",
  articlePathRegex: /(articles|research-spotlight|guides)/,
  siteSuffixRegex: \s*[-–—]\s*strongerbyscience.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "strongerbyscience",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
