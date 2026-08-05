/**
 * seed-samhsa.mjs — SAMHSA seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.samhsa.gov",
  cacheFileName: "samhsa.json",
  displayName: "🧑‍⚕ SAMHSA",
  feedUrl: "https://www.samhsa.gov/feed/",
  articlePathRegex: /(newsroom|find-help|data)/,
  siteSuffixRegex: \s*[-–—]\s*samhsa.gov\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "samhsa",
  seeder_score: 0.9,
  maxArticles: 500,
  maxPages: 20,
});
