/**
 * seed-geron.mjs — Gerontological Society seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.geron.org",
  cacheFileName: "geron.json",
  displayName: "📚 Gerontological Society",
  feedUrl: "https://www.geron.org/feed/",
  articlePathRegex: /(newsroom|publications|meetings)/,
  siteSuffixRegex: \s*[-–—]\s*geron.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "geron",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
