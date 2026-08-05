/**
 * seed-unodc.mjs — UNODC seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.unodc.org",
  cacheFileName: "unodc.json",
  displayName: "🇺🇳 UNODC",
  feedUrl: "https://www.unodc.org/unodc/en/press/rss.xml",
  articlePathRegex: /(unodc|documents|news)/,
  siteSuffixRegex: \s*[-–—]\s*unodc.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "unodc",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
