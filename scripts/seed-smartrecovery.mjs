/**
 * seed-smartrecovery.mjs — SMART Recovery seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.smartrecovery.org",
  cacheFileName: "smartrecovery.json",
  displayName: "🫂 SMART Recovery",
  feedUrl: "https://www.smartrecovery.org/feed/",
  articlePathRegex: /(news|resources|about)/,
  siteSuffixRegex: \s*[-–—]\s*smartrecovery.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "smartrecovery",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
