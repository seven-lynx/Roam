/**
 * seed-thefix.mjs — The Fix seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.thefix.com",
  cacheFileName: "thefix.json",
  displayName: "✍ The Fix",
  feedUrl: "https://www.thefix.com/feed/",
  articlePathRegex: /([a-z0-9-]+-)+/,
  siteSuffixRegex: \s*[-–—]\s*thefix.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "thefix",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
