/**
 * seed-nsca.mjs — NSCA seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.nsca.com",
  cacheFileName: "nsca.json",
  displayName: "💪 NSCA",
  feedUrl: "https://www.nsca.com/feed/",
  articlePathRegex: /(articles|education|research)/,
  siteSuffixRegex: \s*[-–—]\s*nsca.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "nsca",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
