/**
 * seed-recovery-stories.mjs — Recovery Stories seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.recoverystories.net",
  cacheFileName: "recovery-stories.json",
  displayName: "✍ Recovery Stories",
  
  articlePathRegex: /(stories|blog|about)/,
  siteSuffixRegex: \s*[-–—]\s*recoverystories.net\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "recoverystories",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
