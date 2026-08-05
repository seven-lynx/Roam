/**
 * seed-aa-org.mjs — Alcoholics Anonymous seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.aa.org",
  cacheFileName: "aa-org.json",
  displayName: "🫂 Alcoholics Anonymous",
  
  articlePathRegex: /(pages|assets)/,
  siteSuffixRegex: \s*[-–—]\s*aa.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "aa-org",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
