/**
 * seed-cadca.mjs — CADCA seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.cadca.org",
  cacheFileName: "cadca.json",
  displayName: "🫂 CADCA",
  feedUrl: "https://www.cadca.org/feed/",
  articlePathRegex: /(news|resources|about)/,
  siteSuffixRegex: \s*[-–—]\s*cadca.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "cadca",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
