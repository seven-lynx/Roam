/**
 * seed-sleep.mjs — Sleep Review Magazine seeder
 * Clinical sleep medicine news, sleep disorder research, and sleep tech.
 * Category: MIND_BODY → SLEEP_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "sleepreviewmag.com",
  cacheFileName: "sleep.json",
  displayName: "😴 Sleep Review",
  feedUrl: "https://sleepreviewmag.com/feed/",
  articlePathRegex: /\/(sleep|news|features|research|technology|events|press-release)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[-–—]\s*Sleep\s+Review\s*$/i,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.SLEEP_RECOVERY,
  source: "sleepreview",
  seeder_score: 0.55,
  maxArticles: 1000,
  maxPages: 10,
});