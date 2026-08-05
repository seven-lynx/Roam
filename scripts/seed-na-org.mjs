/**
 * seed-na-org.mjs — Narcotics Anonymous seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.na.org",
  cacheFileName: "na-org.json",
  displayName: "🫂 Narcotics Anonymous",
  
  articlePathRegex: /(meetingsearch|about|recovery)/,
  siteSuffixRegex: \s*[-–—]\s*na.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "na-org",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
