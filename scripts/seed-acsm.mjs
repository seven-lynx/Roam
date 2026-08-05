/**
 * seed-acsm.mjs — ACSM seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.acsm.org",
  cacheFileName: "acsm.json",
  displayName: "💪 ACSM",
  feedUrl: "https://www.acsm.org/feed/",
  articlePathRegex: /(blog|news|resources)/,
  siteSuffixRegex: \s*[-–—]\s*acsm.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "acsm",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
